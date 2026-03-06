package main

import (
	"github.com/gorilla/websocket"
)

// type MessageType byte

// const (
// 	NORMAL MessageType = iota
// )

type Message struct {
	SenderName string `json:"senderName"`
	Content    string `json:"content"`
	IsGuess    bool   `json:"isGuess"`
}

type Stroke struct {
	Coordinates [][2]uint16 `json:"coordinates"`
	Color       string      `json:"color"`
	StrokeWidth int         `json:"strokeWidth"`
}

type Canvas struct {
	Strokes      []Stroke `json:"strokes"`
	CurrentColor string   `json:"currentColor"`
	CurrentWidth int      `json:"currentWidth"`
}

type Player struct {
	Conn        *websocket.Conn `json:"-"`
	Name        string          `json:"name"`
	Id          int             `json:"id"`
	Points      int             `json:"points"`
	WriteBuffer chan []byte     `json:"-"`
	token       string
	hasGuessed  bool
	inActive    bool
}
type ScoreInfo struct {
	PlayerName  string `json:"playerName"`
	PointsAdded int    `json:"pointsAdded"`
}
