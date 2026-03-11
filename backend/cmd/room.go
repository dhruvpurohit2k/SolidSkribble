package main

import (
	"sync"

	"github.com/google/uuid"
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
	GUESSWORD
	INCREASEROUNDCOUNT
	SHOWENDSCREEN
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
	CurrentRoundTime uint8
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
		RoundTime:        60,
		CurrentRoundTime: 60,
		NumRound:         3,
	}
	return room
}
