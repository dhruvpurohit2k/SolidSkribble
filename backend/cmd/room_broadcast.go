package main

import "encoding/json"

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
