package main

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"slices"
	"strings"
	"time"
)

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

func (r *Room) BeginGame() {
	for i := uint8(0); i < r.NumRound; i++ {
		r.IncreaseCurrentRoundSignal()
		r.SendNotification(fmt.Sprintf("Round %d", i+1), "BEGINS", nil)
		time.Sleep(4 * time.Second)
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
			r.CurrentRoundTime = r.RoundTime
			r.mu.Unlock()
			r.sendActivePlayer()
			r.ResetCanvas()
			r.SendNotification(fmt.Sprintf("%s's", r.ActivePlayer.Name), "TURN", nil)
			time.Sleep(4 * time.Second)
			r.SendNotification(r.ActivePlayer.Name, "IS CHOOSING A WORD", r.ActivePlayer)
			r.AwaitWordSelection()
			time.Sleep(4 * time.Second)
			gussedPlayer := 0
			go r.SendStartSignal()
			timeOutChan := make(chan struct{})
			stopTimer := make(chan struct{})
			skipped := make(chan struct{})
			go r.StartTimer(timeOutChan, stopTimer, skipped)
			select {
			case <-timeOutChan:
			case <-r.PlayerGussed:
				gussedPlayer++
				r.mu.Lock()
				if gussedPlayer >= len(r.Players)-1 {
					close(stopTimer)
					r.mu.Unlock()
					break
				}
				r.mu.Unlock()
			case <-skipped:
				r.SendNotification(r.ActivePlayer.Name, "didn't return. Skipping his turn", r.ActivePlayer)
				r.PlayerPoints = 10
				time.Sleep(4 * time.Second)
				continue
			}
			r.mu.Lock()
			r.ScoreCard[r.ActivePlayer.Token] = ScoreInfo{
				PlayerName:  r.ActivePlayer.Name,
				PointsAdded: 5,
				Token:       r.ActivePlayer.Token,
			}
			r.ActivePlayer.Points += 5
			for _, player := range r.Players {
				player.hasGuessed = false
				if player == r.ActivePlayer {
					continue
				}
				if _, ok := r.ScoreCard[player.Token]; !ok {
					r.ScoreCard[player.Token] = ScoreInfo{
						PlayerName:  player.Name,
						PointsAdded: 0,
						Token:       player.Token,
					}
				}
			}
			r.PlayerPoints = 10
			r.mu.Unlock()
			r.ShowScore()
			time.Sleep(4 * time.Second)

		}
	}
	r.SendNotification("GAME END", "Thank you for playing", nil)
	time.Sleep(4 * time.Second)
	r.ShowEndScreen()
	r.QuitChannel <- struct{}{}
}

func (r *Room) ShowEndScreen() {
	buffer := make([]byte, 1)
	buffer[0] = byte(SHOWENDSCREEN)
	r.mu.Lock()
	for _, player := range r.Players {
		player.WriteBuffer <- buffer
	}
	r.mu.Unlock()
}

func (r *Room) IncreaseCurrentRoundSignal() {
	buffer := make([]byte, 1)
	buffer[0] = byte(INCREASEROUNDCOUNT)
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, player := range r.Players {
		player.WriteBuffer <- buffer
	}
}

func (r *Room) StartTimer(timeOutChan chan struct{}, stopTimer chan struct{}, skipped chan struct{}) {

	elaspedTime := r.RoundTime
	ticker := time.NewTicker(1 * time.Second)
	waitTime := 20
	for {
		select {
		case <-ticker.C:
			r.mu.Lock()
			if r.ActivePlayer.InActive {
				if waitTime == 20 {
					r.mu.Unlock()
					r.SendNotification(r.ActivePlayer.Name, "has Disconnected. Wainting 20sec before skipping", r.ActivePlayer)
					r.mu.Lock()
				}
				if waitTime > 0 {
					waitTime--
<<<<<<< HEAD
					fmt.Println("TIMER REDUCING TO ", waitTime)
				} else {
					r.mu.Unlock()
					fmt.Println("LEAVING THE FUNCTION", waitTime)
=======
				} else {
					r.mu.Unlock()
>>>>>>> cbb6e35 (Refactor backend code into smaller files.)
					close(skipped)
					return
				}
				r.mu.Unlock()
				continue
			}
			r.mu.Unlock()
			buffer := make([]byte, 2)
			buffer[0] = byte(ROUNDTIMESELECTION)
			buffer[1] = byte(elaspedTime)
			r.mu.Lock()
			for _, player := range r.Players {
				player.WriteBuffer <- buffer
			}
			r.mu.Unlock()
			elaspedTime--
			if elaspedTime == 0 {
				close(timeOutChan)
				return
			}
		case <-stopTimer:
			return
		}
	}
}

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
	notification := struct {
		Heading string `json:"heading"`
		Content string `json:"content"`
	}{
		Heading: "SELECT ONE WORD OUT OF THE FOLLOWING",
		Content: "",
	}
	notiPayload, _ := json.Marshal(notification)
	notificationBuffer := make([]byte, len(notiPayload)+1)
	notificationBuffer[0] = byte(NOTIFICATION)
	copy(notificationBuffer[1:], notiPayload)
	r.ActivePlayer.WriteBuffer <- notificationBuffer
	time.Sleep(4 * time.Second)
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
	selectedWordIndex := <-r.wordSelectedChan
	r.CurrentWord = data.Words[int(selectedWordIndex)]
	r.mu.Unlock()
	r.SendCurrentWord()
}

func (r *Room) SendCurrentWord() {
	guessStr := []byte(strings.Repeat("_ ", len(r.CurrentWord)))
	guessBuffer := make([]byte, len(guessStr)+1)
	guessBuffer[0] = byte(GUESSWORD)
	copy(guessBuffer[1:], guessStr)
	drawWord := []byte(r.CurrentWord)
	drawWordBuffer := make([]byte, len(drawWord)+1)
	drawWordBuffer[0] = byte(GUESSWORD)
	copy(drawWordBuffer[1:], drawWord)
	r.mu.Lock()
	for _, player := range r.Players {
		if player.Id == r.ActivePlayer.Id {
			player.WriteBuffer <- drawWordBuffer
		} else {
			player.WriteBuffer <- guessBuffer
		}
	}
	r.mu.Unlock()
}

func (r *Room) ChangeRoundTime(p []byte) {
	r.mu.Lock()
	r.RoundTime = uint8(p[1])
	r.CurrentRoundTime = r.RoundTime
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
