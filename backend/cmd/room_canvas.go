package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
)

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

func (r *Room) UndoCanvas() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.Canvas.Strokes) == 0 {
		return
	}
	r.Canvas.Strokes = r.Canvas.Strokes[0 : len(r.Canvas.Strokes)-1]
}

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

func (r *Room) ResetCanvas() {
	r.mu.Lock()
	r.Canvas = Canvas{Strokes: make([]Stroke, 0, 20), CurrentColor: "#000000", CurrentWidth: 1}
	canvasState, _ := json.Marshal(r.Canvas)
	CanvasBuffer := make([]byte, len(canvasState)+1)
	CanvasBuffer[0] = byte(CANVASSTATE)
	copy(CanvasBuffer[1:], canvasState)
	for _, player := range r.Players {
		player.WriteBuffer <- CanvasBuffer
	}
	r.mu.Unlock()

}
