package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"math/rand/v2"
	"slices"
	"strings"
	"sync"
	"time"

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
	WORDSELECTION
	ROUNDTIMESELECTION
	REQUESTUSERNAME
	REQUESTTOKEN
	SERVERDENIED
	SCOREBOARD
	ROUNDSTARTSIGNAL
	ROUNDENDSIGNAL
	ROUNDCOUNT
)

type Room struct {
	mu               sync.Mutex
	IsGameOn         bool
	idCounter        int
	Players          []*Player
	Canvas           Canvas
	Leader           *Player
	ActivePlayer     *Player
	RoomId           string
	Messages         []Message
	QuitChannel      chan struct{}
	StartRound       chan struct{}
	CurrentWord      string
	words            []string
	wordSelectedChan chan uint8
	RoundTime        uint8
	AllPlayerGussed  chan struct{}
	PlayerGussed     chan struct{}
	PlayerPoints     int
	TokenToPlayerMap map[string]*Player
	ScoreCard        map[string]ScoreInfo
	NumRound         uint8
}

// Adds Player to the room
func (r *Room) AddPlayer(conn *websocket.Conn) {
	token, err := r.GetUserToken(conn)
	if err != nil {
		data := struct {
			Message string `json:"message"`
		}{
			Message: "Fail to recive user token",
		}
		payload, _ := json.Marshal(data)
		buffer := make([]byte, len(payload)+1)
		buffer[0] = byte(SERVERDENIED)
		copy(buffer[1:], payload)
		conn.WriteMessage(websocket.BinaryMessage, buffer)
		conn.Close()
		r.mu.Unlock()
		return
	}
	var newPlayer *Player
	r.mu.Lock()
	if player, ok := r.TokenToPlayerMap[token]; ok {
		player.Conn = conn
		newPlayer = player
		r.Players = append(r.Players, newPlayer)
		// fmt.Printf("REPLACED OLD PLAYER %s WITHE NEW CONNECTION\n", player.Name)
	} else {
		username, err := r.GetUserName(conn)
		if err != nil {
			data := struct {
				Message string `json:"message"`
			}{
				Message: "Fail to recive username",
			}
			payload, _ := json.Marshal(data)
			buffer := make([]byte, len(payload)+1)
			buffer[0] = byte(SERVERDENIED)
			copy(buffer[1:], payload)
			conn.WriteMessage(websocket.BinaryMessage, buffer)
			conn.Close()
			r.mu.Unlock()
			return
		}
		newPlayer = &Player{
			Name:        username,
			Conn:        conn,
			Id:          r.idCounter + 1,
			WriteBuffer: make(chan []byte),
			token:       token,
		}
		r.TokenToPlayerMap[token] = newPlayer
		// fmt.Printf("ADDED NEW PLAYER WITH NAME %s and TOKEN %s\n", newPlayer.Name, newPlayer.token)
		r.Players = append(r.Players, newPlayer)
		go r.PlayerWriter(newPlayer)
		r.idCounter++
	}
	if r.Leader == nil {
		r.Leader = newPlayer
	}
	go r.PlayerListener(newPlayer)
	r.mu.Unlock()
	r.sendPlayerListUpdate()
	r.sendLeader()
	r.mu.Lock()
	gameState := r.IsGameOn
	r.mu.Unlock()
	if gameState == true {
		r.UpdateNewPlayer(newPlayer)
	}
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

// USER INFO / SIGNALS
// // GET TOKEN

func (r *Room) GetUserToken(conn *websocket.Conn) (string, error) {
	code := make([]byte, 1)
	code[0] = byte(REQUESTTOKEN)
	conn.WriteMessage(websocket.BinaryMessage, code)
	_, tokenPayload, err := conn.ReadMessage()
	if err != nil {
		return "", err
	}
	return string(tokenPayload), nil

}

// // GET USERNAME
// Send Updates to newly Added player
func (r *Room) GetUserName(conn *websocket.Conn) (string, error) {
	code := make([]byte, 1)
	code[0] = byte(REQUESTUSERNAME)
	conn.WriteMessage(websocket.BinaryMessage, code)
	_, tokenPayload, err := conn.ReadMessage()
	if err != nil {
		return "", err
	}
	return string(tokenPayload), nil

}

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
		r.mu.Lock()
		isLeader := r.Leader != nil && r.Leader == player
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
		} else if isLeader {
			r.Leader = updatePlayerList[0]
		}
		// fmt.Printf("PLAYER %s left, new list is %v\n", player.Name, updatePlayerList)
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
			go r.HandleUserMessage(p, player)
		case STROKEWIDTH:
			if r.ActivePlayer.Id != player.Id {
				continue
			}
			go r.broadcastChange(p, player)
			r.ChangeCurrentStrokeWidth(p)

		case ROUNDTIMESELECTION:
			if r.Leader != player {
				continue
			}
			go r.ChangeRoundTime(p)
		case ROUNDCOUNT:
			if r.Leader != player {
				continue
			}
			go r.ChangeRoundCount(p)
		case WORDSELECTION:
			if r.ActivePlayer != player {
				continue
			}
			r.wordSelectedChan <- p[1]

		default:
			fmt.Println("METHOD NOT IMPLEMENTED", opCode)
		}

	}
}

func (r *Room) ChangeRoundTime(p []byte) {
	r.mu.Lock()
	r.RoundTime = uint8(p[1])
	for _, player := range r.Players {
		player.WriteBuffer <- p
	}
	r.mu.Unlock()

}

func (r *Room) ChangeRoundCount(p []byte) {
	r.mu.Lock()
	r.NumRound = uint8(p[1])
	for _, player := range r.Players {
		player.WriteBuffer <- p
	}
	r.mu.Unlock()
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
func (r *Room) HandleUserMessage(p []byte, player *Player) {
	jsonBytes := p[1:]
	message := struct {
		SenderName string `json:"senderName"`
		Content    string `json:"content"`
	}{}
	json.Unmarshal(jsonBytes, &message)
	if strings.ToLower(message.Content) == strings.ToLower(r.CurrentWord) && !player.hasGuessed {
		message.Content = "GUESSED"
		fmt.Println(player.Name, "GUSSED CORRECTLY")
		r.mu.Lock()
		r.ScoreCard[player.Name] = ScoreInfo{
			PlayerName:  player.Name,
			PointsAdded: r.PlayerPoints,
		}
		player.Points = player.Points + r.PlayerPoints
		r.PlayerPoints = max(int(math.Round(float64(r.PlayerPoints)*0.8)), 1)
		r.PlayerGussed <- struct{}{}
		player.hasGuessed = true
		r.mu.Unlock()
	}
	payload, _ := json.Marshal(message)
	buffer := make([]byte, len(payload)+1)
	buffer[0] = byte(MESSAGEINPUT)
	copy(buffer[1:], payload)
	r.mu.Lock()
	for _, player := range r.Players {
		player.WriteBuffer <- buffer
	}
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
			r.ScoreCard = make(map[string]ScoreInfo, len(r.Players))
			r.mu.Unlock()
			r.sendActivePlayer()
			r.SendNotification(r.ActivePlayer.Name, "is the active player", nil)
			timer := time.After(3 * time.Second)
			<-timer
			r.SendNotification("", fmt.Sprintf("%s is choosing Word", r.ActivePlayer.Name), r.ActivePlayer)
			r.AwaitWordSelection()
			timer = time.After(time.Duration(r.RoundTime) * time.Second)
			// fmt.Println("Waiting for ", r.RoundTime)
			gussedPlayer := 0
			go r.SendStartSignal()
			select {
			case <-timer:
				r.ShowScore()
				fmt.Println("TIMER RAN OUT")
			case <-r.PlayerGussed:
				fmt.Println("ONE PLAYER GUSSED CORRECTLY")
				gussedPlayer++
				r.mu.Lock()
				if gussedPlayer >= len(r.Players)-1 {
					fmt.Println("ALL PLAYER GUSSED CORRECTLY")
					r.mu.Unlock()
					break
				}
				r.mu.Unlock()

			}
			r.mu.Lock()
			for _, player := range r.Players {
				player.hasGuessed = false
				if _, ok := r.ScoreCard[player.Name]; !ok {
					r.ScoreCard[player.Name] = ScoreInfo{
						PlayerName:  player.Name,
						PointsAdded: 0,
					}
				}

			}
			r.PlayerPoints = 10
			r.mu.Unlock()
			r.ShowScore()
			timer = time.After(5 * time.Second)
			<-timer

		}
	}
	r.QuitChannel <- struct{}{}
}

// func (r *Room) GuessListener(timer <-chan time.Time) {
// 	// Using AllPlayerGuessed as make do channel to close the thread if timer runs out.
// 	correctGuessCount := 0
// 	allGussed := false
// 	for range timer {
// 		select {
// 		case <-r.PlayerGussed:
// 			correctGuessCount++
// 			r.mu.Lock()
// 			defer r.mu.Unlock()
// 			if correctGuessCount >= len(r.Players)-1 {
// 				allGussed = true
// 				break
// 			}
// 		}
// 	}
// 	if allGussed {
// 		r.AllPlayerGussed <- struct{}{}
// 	}
// 	return

// }
func (r *Room) ShowScore() {
	r.mu.Lock()
	defer r.mu.Unlock()
	data := make([]ScoreInfo, 0, len(r.ScoreCard))
	for _, score := range r.ScoreCard {
		data = append(data, score)
	}
	payload, _ := json.Marshal(data)
	buffer := make([]byte, len(payload)+1)
	buffer[0] = byte(SCOREBOARD)
	copy(buffer[1:], payload)
	for _, player := range r.Players {
		player.WriteBuffer <- buffer
	}
}

func (r *Room) AwaitWordSelection() {
	words := make(map[string]struct{}, 3)
	for len(words) < 3 {
		index := rand.IntN(len(r.words))
		_, ok := words[r.words[index]]
		if !ok {
			words[r.words[index]] = struct{}{}
		}
	}
	data := struct {
		Words []string `json:"words"`
	}{Words: make([]string, 0, 3)}
	for k, _ := range words {
		data.Words = append(data.Words, k)
	}
	payload, _ := json.Marshal(data)
	buffer := make([]byte, len(payload)+1)
	buffer[0] = byte(WORDSELECTION)
	copy(buffer[1:], payload)
	r.mu.Lock()
	r.ActivePlayer.WriteBuffer <- buffer
	r.mu.Unlock()
	selectedWordIndex := <-r.wordSelectedChan
	fmt.Println(selectedWordIndex)
	r.CurrentWord = data.Words[int(selectedWordIndex)]
	fmt.Println("Selected Word is ", r.CurrentWord)
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

func (r *Room) SendStartSignal() {
	buffer := make([]byte, 1)
	buffer[0] = byte(ROUNDSTARTSIGNAL)
	r.mu.Lock()
	for _, player := range r.Players {
		player.WriteBuffer <- buffer
	}
	r.mu.Unlock()
}
func CreateRoom(words []string) *Room {
	room := &Room{
		mu:               sync.Mutex{},
		idCounter:        0,
		Players:          make([]*Player, 0, 3),
		Canvas:           Canvas{Strokes: make([]Stroke, 0, 20), CurrentColor: "#000000", CurrentWidth: 1},
		Leader:           nil,
		ActivePlayer:     nil,
		RoomId:           uuid.NewString(),
		Messages:         make([]Message, 0, 20),
		QuitChannel:      make(chan struct{}),
		StartRound:       make(chan struct{}),
		CurrentWord:      "",
		words:            words,
		wordSelectedChan: make(chan uint8),
		AllPlayerGussed:  make(chan struct{}),
		TokenToPlayerMap: make(map[string]*Player, 10),
		PlayerGussed:     make(chan struct{}),
		PlayerPoints:     10,
	}
	return room
}
