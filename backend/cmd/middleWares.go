package main

import (
	"net/http"
)

type MiddleWare func(next http.Handler) http.Handler

func setupMiddleWares(middlewares ...MiddleWare) MiddleWare {
	return func(final http.Handler) http.Handler {
		for _, middleware := range middlewares {
			final = middleware(final)
		}
		return final
	}
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)

	})
}
