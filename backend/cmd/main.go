package main

import (
	"fmt"
	"net/http"
)

func main() {
	server := createServer()
	middlesware := setupMiddleWares(enableCORS)
	fmt.Println("Listening to port 5000....")
	http.ListenAndServe(":5000", middlesware(server))
}
