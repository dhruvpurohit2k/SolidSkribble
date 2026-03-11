package main

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

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
		player.InActive = false
		newPlayer = player
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
			Token:       token,
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

func (r *Room) PlayerListener(player *Player) {
	conn := player.Conn
	defer func() {
		player.InActive = true
		r.sendPlayerListUpdate()
		time.Sleep(30 * time.Second)
		if !player.InActive {
			return
		}
		r.mu.Lock()
		updatedList := make([]*Player, 0, max(len(r.Players)-1, 0))
		for _, oldPlayer := range r.Players {
			if oldPlayer != player {
				updatedList = append(updatedList, oldPlayer)
			}
		}
		r.Players = updatedList
		if r.Leader == player {
			if len(r.Players) > 0 {
				r.Leader = r.Players[0]
				r.mu.Unlock()
				r.sendLeader()
				r.mu.Lock()
			} else {
				r.Leader = nil
			}
		}
		delete(r.TokenToPlayerMap, player.Token)
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
			if len(r.Players) < 2 {
				r.SendNotification("Need at least 2 players to play", "", nil)
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

func (r *Room) UpdateNewPlayer(newPlayer *Player) {
	var leaderId, activePlayerId int
	var currentTime, numRound uint8
	r.mu.Lock()
	canvasState, _ := json.Marshal(r.Canvas)
	currentTime = r.CurrentRoundTime
	numRound = r.NumRound

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
	r.SendCurrentWord()
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
	buffer = make([]byte, 2)
	buffer[0] = byte(ROUNDCOUNT)
	buffer[1] = byte(numRound)
	newPlayer.WriteBuffer <- buffer
	buffer = make([]byte, 2)
	buffer[0] = byte(ROUNDTIMESELECTION)
	buffer[1] = byte(currentTime)
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

func (r *Room) HandleUserMessage(p []byte, player *Player) {
	jsonBytes := p[1:]
	message := Message{}
	json.Unmarshal(jsonBytes, &message)
	if strings.ToLower(message.Content) == strings.ToLower(r.CurrentWord) && !player.hasGuessed {
		message.Content = strings.Repeat("_", len(message.Content))
		message.IsGuess = true
		r.mu.Lock()
		r.ScoreCard[player.Token] = ScoreInfo{
			PlayerName:  player.Name,
			PointsAdded: r.PlayerPoints,
			Token:       player.Token,
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
