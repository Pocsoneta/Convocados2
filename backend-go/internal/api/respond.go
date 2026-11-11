package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
)

// JSON responde con status y cuerpo. `v == nil` se escribe como `null`
// (el front espera un JSON válido siempre).
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("error codificando respuesta: %v", err)
	}
}

// Error responde siempre con el mismo formato: {"error": "..."}
// El front hace `throw new Error(data.error)`, así que el mensaje
// tiene que ser humano.
func Error(w http.ResponseWriter, status int, mensaje string) {
	JSON(w, status, map[string]string{"error": mensaje})
}

// decodificar lee el body JSON de la request (máx 10 MB: la foto
// del perfil viaja en base64 dentro del JSON).
// No exige campos exactos: si el front manda algo de más, no rompe.
func decodificar(w http.ResponseWriter, r *http.Request, destino any) error {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 10<<20))
	if err := dec.Decode(destino); err != nil {
		return err
	}
	return nil
}

// ErrJSON es el error que devuelven los handlers cuando el 4xx/5xx
// ya viene armado (lleva su propio mensaje).
type ErrJSON struct {
	Status  int
	Mensaje string
}

func (e *ErrJSON) Error() string { return e.Mensaje }

func respondeErrJSON(w http.ResponseWriter, err error) {
	var e *ErrJSON
	if errors.As(err, &e) {
		Error(w, e.Status, e.Mensaje)
		return
	}
	log.Printf("error interno: %v", err)
	Error(w, http.StatusInternalServerError, "No pudimos completar la operación. Probá de nuevo.")
}

func mal(mensaje string) *ErrJSON {
	return &ErrJSON{Status: http.StatusBadRequest, Mensaje: mensaje}
}

func noEncontrado(mensaje string) *ErrJSON {
	return &ErrJSON{Status: http.StatusNotFound, Mensaje: mensaje}
}
