package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"slices"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type WebSocketMessageType byte

const (
	GAMESTATE WebSocketMessageType = iota
	PLAYERUPDATE
	MESSAGEUPDATE
	CANVASUPDATE
	CANVASINPUT
	CANVASUNDO
	STROKECOLOR
	STROKEWIDTH
	ACTIVEPLAYERCHANGE
	LEADERCHANGE
	CANVASSTATE
	MESSAGEINPUT
	NOTIFICATION
)

type Room struct {
	mu           sync.Mutex
	IsGameOn     bool
	idCounter    int
	Players      []*Player
	Canvas       Canvas
	Leader       *Player
	ActivePlayer *Player
	RoomId       string
	Messages     []Message
	QuitChannel  chan struct{}
	StartRound   chan struct{}
}

// Adds Player to the room
func (r *Room) AddPlayer(playerName string, conn *websocket.Conn) {
	r.mu.Lock()
	newPlayer := &Player{
		Name:        playerName,
		Conn:        conn,
		Id:          r.idCounter + 1,
		WriteBuffer: make(chan []byte),
	}
	r.Players = append(r.Players, newPlayer)
	go r.PlayerWriter(newPlayer)
	r.idCounter++
	leader := r.Leader
	if leader == nil {
		r.Leader = newPlayer
		// r.ActivePlayer = newPlayer
	}
	r.mu.Unlock()
	r.sendPlayerListUpdate()
	r.sendLeader()
	r.mu.Lock()
	gameState := r.IsGameOn
	r.mu.Unlock()
	if gameState == true {
		r.UpdateNewPlayer(newPlayer)
	}
	r.PlayerListener(newPlayer)
}

// Update the newly Added player's game state
func (r *Room) UpdateNewPlayer(newPlayer *Player) {
	var leaderId, activePlayerId int
	r.mu.Lock()
	canvasState, _ := json.Marshal(r.Canvas)
	if r.Leader == nil {
		leaderId = 0
	} else {
		leaderId = r.Leader.Id
	}
	if r.ActivePlayer == nil {
		activePlayerId = 0
	} else {
		activePlayerId = r.ActivePlayer.Id
	}
	r.mu.Unlock()
	buffer := make([]byte, 2)
	buffer[0] = byte(GAMESTATE)
	buffer[1] = byte(1)
	newPlayer.WriteBuffer <- buffer
	buffer = make([]byte, 2)
	buffer[0] = byte(LEADERCHANGE)
	buffer[1] = byte(leaderId)
	newPlayer.WriteBuffer <- buffer
	buffer = make([]byte, 2)
	buffer[0] = byte(ACTIVEPLAYERCHANGE)
	buffer[1] = byte(activePlayerId)
	newPlayer.WriteBuffer <- buffer
	CanvasBuffer := make([]byte, len(canvasState)+1)
	CanvasBuffer[0] = byte(CANVASSTATE)
	copy(CanvasBuffer[1:], canvasState)
	newPlayer.WriteBuffer <- CanvasBuffer
}
func (r *Room) PlayerWriter(player *Player) {
	for message := range player.WriteBuffer {
		if player.Conn == nil {
			return
		}
		player.Conn.WriteMessage(websocket.BinaryMessage, message)
	}
}

//Send Updates to newly Added player

// Broadcasts updated player list to all the connected players
func (r *Room) sendPlayerListUpdate() {
	r.mu.Lock()
	playersJson, _ := json.Marshal(r.Players)
	buffer := make([]byte, len(playersJson)+1)
	buffer[0] = byte(PLAYERUPDATE)
	copy(buffer[1:], playersJson)
	for _, player := range r.Players {
		player.WriteBuffer <- buffer
	}
	r.mu.Unlock()

}

// Listens for player's messages
func (r *Room) PlayerListener(player *Player) {
	conn := player.Conn
	defer func() {
		close(player.WriteBuffer)
		r.mu.Lock()
		updatePlayerList := make([]*Player, 0, max(len(r.Players)-1, 0))
		for _, p := range r.Players {
			if p.Id == player.Id {
				continue
			}
			updatePlayerList = append(updatePlayerList, p)
		}
		if len(updatePlayerList) == 0 {
			r.Leader = nil
			r.ActivePlayer = nil
		} else if r.Leader.Id == player.Id {
			r.Leader = updatePlayerList[0]
		}
		r.Players = updatePlayerList
		r.mu.Unlock()
		r.sendPlayerListUpdate()
	}()

	for {
		_, p, err := conn.ReadMessage()
		if err != nil {
			break
		}

		opCode := WebSocketMessageType(p[0])

		switch opCode {
		case GAMESTATE:

			if player.Id != r.Leader.Id {
				continue
			}
			go r.broadcastGameUpdate(p)
		case CANVASINPUT:
			if r.ActivePlayer.Id != player.Id {
				continue
			}
			go r.broadcastChange(p, player)
			r.UpdateCanvas(p)
		case CANVASUNDO:
			if r.ActivePlayer.Id != player.Id {
				continue
			}
			go r.broadcastChange(p, player)
			r.UndoCanvas()

		case STROKECOLOR:
			if r.ActivePlayer.Id != player.Id {
				continue
			}
			go r.broadcastChange(p, player)
			r.ChangeCurrentColor(p)

		case MESSAGEINPUT:
			go r.broadcastChange(p, player)
			r.AddMesssage(p)
		case STROKEWIDTH:
			if r.ActivePlayer.Id != player.Id {
				continue
			}
			go r.broadcastChange(p, player)
			r.ChangeCurrentStrokeWidth(p)

		default:
			fmt.Println("METHOD NOT IMPLEMENTED", opCode)
		}

	}
}

// Send the new Leader to other players
func (r *Room) sendLeader() {
	buffer := make([]byte, 2)
	buffer[0] = byte(LEADERCHANGE)
	var leaderId int
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.Leader == nil {
		leaderId = 0
	} else {
		leaderId = r.Leader.Id
	}
	buffer[1] = byte(leaderId)
	for _, player := range r.Players {
		player.WriteBuffer <- buffer
	}
}

// Send the new Active player
func (r *Room) sendActivePlayer() {
	fmt.Println("Sending active Player", r.ActivePlayer.Id)
	buffer := make([]byte, 2)
	buffer[0] = byte(ACTIVEPLAYERCHANGE)
	var activePlayerId int
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.ActivePlayer == nil {
		activePlayerId = 0
	} else {
		activePlayerId = r.ActivePlayer.Id
	}
	buffer[1] = byte(activePlayerId)
	for _, player := range r.Players {
		player.WriteBuffer <- buffer
	}
}

// Canvas State Funcs
func (r *Room) UpdateCanvas(p []byte) {
	inputState := byte(p[1])
	switch inputState {
	case byte(0):
		newStroke := Stroke{Coordinates: make([][2]uint16, 0, 1000), Color: r.Canvas.CurrentColor, StrokeWidth: r.Canvas.CurrentWidth}
		x := binary.BigEndian.Uint16(p[2:4])
		y := binary.BigEndian.Uint16(p[4:])
		newCoordinate := [2]uint16{x, y}
		newStroke.Coordinates = append(newStroke.Coordinates, [2]uint16(newCoordinate))
		r.mu.Lock()
		r.Canvas.Strokes = append(r.Canvas.Strokes, newStroke)
		r.mu.Unlock()
	case byte(1):
		x := binary.BigEndian.Uint16(p[2:4])
		y := binary.BigEndian.Uint16(p[4:])
		newCoordinate := [2]uint16{x, y}
		r.mu.Lock()
		r.Canvas.Strokes[len(r.Canvas.Strokes)-1].Coordinates = append(r.Canvas.Strokes[len(r.Canvas.Strokes)-1].Coordinates, newCoordinate)
		r.mu.Unlock()

	case byte(2):
	default:
		fmt.Println("INVALID MOUSE EVENT FOR CANVAS INPUT")
	}
}

// Undo The canvas
func (r *Room) UndoCanvas() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.Canvas.Strokes) == 0 {
		return
	}
	r.Canvas.Strokes = r.Canvas.Strokes[0 : len(r.Canvas.Strokes)-1]
}

// Send Color Update to other players
func (r *Room) ChangeCurrentColor(p []byte) {
	jsonBytes := p[1:]
	colorData := struct {
		Color string `json:"color"`
	}{}
	json.Unmarshal(jsonBytes, &colorData)
	r.mu.Lock()
	r.Canvas.CurrentColor = colorData.Color
	r.mu.Unlock()
}

// Send Stroke Width Update to other players
func (r *Room) ChangeCurrentStrokeWidth(p []byte) {
	jsonBytes := p[1:]
	strokeData := struct {
		Width int `json:"width"`
	}{}
	json.Unmarshal(jsonBytes, &strokeData)
	r.mu.Lock()
	r.Canvas.CurrentWidth = strokeData.Width
	r.mu.Unlock()
}

// WebSocketMessage Handlers
func (r *Room) broadcastGameUpdate(payload []byte) {
	if payload[1] == byte(1) {
		r.mu.Lock()
		r.IsGameOn = true
		for _, player := range r.Players {
			player.WriteBuffer <- payload
		}
		r.mu.Unlock()
		go r.Start()
		r.StartRound <- struct{}{}
	}
}

// Sending Msg to other players
func (r *Room) broadcastChange(p []byte, sender *Player) {
	r.mu.Lock()
	for _, player := range r.Players {
		if sender != nil && sender == player {
			continue
		}
		player.WriteBuffer <- p
	}
	r.mu.Unlock()
}

// Add Message
func (r *Room) AddMesssage(p []byte) {
	jsonBytes := p[1:]
	message := struct {
		SenderName string `json:"senderName"`
		Content    string `json:"content"`
	}{}
	json.Unmarshal(jsonBytes, &message)
	r.mu.Lock()
	r.Messages = append(r.Messages, message)
	r.mu.Unlock()
}

// Main game logic
func (r *Room) Start() {
	for {
		select {
		case <-r.QuitChannel:
			return

		case <-r.StartRound:
			r.BeginGame()
		}
	}
}

//Round Logic

func (r *Room) BeginGame() {
	for i := 0; i <= 2; i++ {
		r.mu.Lock()
		snapShot := make([]*Player, len(r.Players))
		copy(snapShot, r.Players)
		r.mu.Unlock()
		for _, player := range snapShot {
			r.mu.Lock()
			if !slices.Contains(r.Players, player) {
				r.mu.Unlock()
				continue
			}
			r.ActivePlayer = player
			r.mu.Unlock()
			r.sendActivePlayer()
			r.SendNotification("ACTIVE PLAYER", r.ActivePlayer.Name, nil)
			timer := time.After(3 * time.Second)
			<-timer
		}
	}
	r.QuitChannel <- struct{}{}
}
func (r *Room) SendNotification(heading string, content string, skipPlayer *Player) {
	notification := struct {
		Heading string `json:"heading"`
		Content string `json:"content"`
	}{}
	notification.Heading = heading
	notification.Content = content
	notificationString, _ := json.Marshal(notification)
	buffer := make([]byte, len(notificationString)+1)
	buffer[0] = byte(NOTIFICATION)
	copy(buffer[1:], notificationString)
	r.mu.Lock()
	for _, player := range r.Players {
		if player == skipPlayer {
			continue
		}
		player.WriteBuffer <- buffer
	}
	r.mu.Unlock()
}
func CreateRoom() *Room {
	room := &Room{
		mu:           sync.Mutex{},
		idCounter:    0,
		Players:      make([]*Player, 0, 3),
		Canvas:       Canvas{Strokes: make([]Stroke, 0, 20), CurrentColor: "#000000", CurrentWidth: 1},
		Leader:       nil,
		ActivePlayer: nil,
		RoomId:       uuid.NewString(),
		Messages:     make([]Message, 0, 20),
		QuitChannel:  make(chan struct{}),
		StartRound:   make(chan struct{}),
	}
	return room
}
