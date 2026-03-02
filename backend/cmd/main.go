package main

import (
	"fmt"
	"net/http"
)

func main() {
	skribblWords := []string{
		// Easy: Everyday Objects & Nature
		"Apple", "Bicycle", "Candle", "Dolphin", "Egg", "Flower", "Guitar", "Hammer", "Iceberg", "Jacket",
		"Kite", "Laptop", "Mountain", "Notebook", "Ocean", "Pencil", "Quilt", "Rocket", "Starfish", "Teapot",
		"Umbrella", "Volcano", "Watch", "Xylophone", "Yo-yo", "Zebra", "Bread", "Cloud", "Drum", "Eagle",

		// Medium: Actions, Places & Specific Concepts
		"Archery", "Bakery", "Campfire", "Dentist", "Elevator", "Factory", "Gardening", "Highway", "Island", "Jungle",
		"Keyboard", "Library", "Museum", "Nightmare", "Orbit", "Pyramid", "Quicksand", "Rainbow", "Skeleton", "Tornado",
		"Universe", "Vacation", "Waterfall", "Yoga", "Zipper", "Beard", "Castle", "Desert", "Electricity", "Fireworks",

		// Hard: Abstract Ideas & Complex Objects
		"Architecture", "Blizzard", "Chameleon", "Dimension", "Echo", "Flamenco", "Galaxy", "Hologram", "Infinity", "Journalist",
		"Kaleidoscope", "Labyrinth", "Metaphor", "Nostalgia", "Oasis", "Paradox", "Quest", "Reflection", "Silhouette", "Tapestry",
		"Utopia", "Velocity", "Whisper", "X-ray", "Yearbook", "Zodiac", "Bungie", "Cathedral", "Drought", "Eclipse",

		// Extra Fun/Random
		"Marshmallow", "Sushi", "Cowboy", "Pirate", "Cactus", "Spacecraft", "Microscope", "Telescope", "Pineapple", "Submarine",
	}
	server := createServer(skribblWords)
	middlesware := setupMiddleWares(enableCORS)
	fmt.Println("Listening to port 5000....")
	http.ListenAndServe(":5000", middlesware(server))
}
