package main

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

type SolidSkribbleServer struct {
	mux   *http.ServeMux
	rooms map[string]*Room
	words []string
	mu    sync.RWMutex
}

func (s *SolidSkribbleServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func (s *SolidSkribbleServer) SetupRoutes() {
	s.mux.HandleFunc("PUT /createroom", s.createRoom)
	s.mux.HandleFunc("GET /game/{id}", s.joinGame)
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  512,
	WriteBufferSize: 512,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func createServer(words []string) *SolidSkribbleServer {
	rooms := make(map[string]*Room, 10)
	server := &SolidSkribbleServer{}
	server.words = words
	server.rooms = rooms
	server.mux = &http.ServeMux{}
	server.mu = sync.RWMutex{}
	server.SetupRoutes()
	return server
}

func (s *SolidSkribbleServer) createRoom(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	newRoom := CreateRoom(s.words)
	s.rooms[newRoom.RoomId] = newRoom
	s.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"roomId": newRoom.RoomId})
}

func (s *SolidSkribbleServer) joinGame(w http.ResponseWriter, r *http.Request) {
	gameId := r.PathValue("id")
	s.mu.RLock()
	room, ok := s.rooms[gameId]
	s.mu.RUnlock()
	if !ok {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	_, p, err := conn.ReadMessage()
	if err != nil {
		conn.Close()
		return
	}
	room.AddPlayer(string(p), conn)
}
