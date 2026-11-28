package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Error escribe {"error": "..."} con Content-Type JSON.
func TestErrorFormato(t *testing.T) {
	w := httptest.NewRecorder()
	Error(w, http.StatusNotFound, "No encontramos ese partido.")

	if w.Code != http.StatusNotFound {
		t.Errorf("código = %d, esperaba 404", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.Contains(ct, "application/json") {
		t.Errorf("Content-Type = %q, esperaba JSON", ct)
	}
	var cuerpo map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &cuerpo); err != nil {
		t.Fatalf("el cuerpo no es JSON válido: %v (%q)", err, w.Body.String())
	}
	if cuerpo["error"] != "No encontramos ese partido." {
		t.Errorf("error = %q, esperaba el mensaje", cuerpo["error"])
	}
}

// JSON escribe cualquier valor como JSON válido (nil -> null).
func TestJSONRespuestas(t *testing.T) {
	w := httptest.NewRecorder()
	JSON(w, http.StatusOK, nil)
	if w.Body.String() != "null\n" {
		t.Errorf("JSON(nil) = %q, esperaba \"null\\n\"", w.Body.String())
	}

	w = httptest.NewRecorder()
	JSON(w, http.StatusCreated, map[string]any{"id": int64(3)})
	var cuerpo map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &cuerpo); err != nil {
		t.Fatalf("el cuerpo no es JSON válido: %v", err)
	}
	if cuerpo["id"].(float64) != 3 {
		t.Errorf("id = %v, esperaba 3", cuerpo["id"])
	}
}

// respondeErrJSON distingue ErrJSON (status propio) de un error interno.
func TestRespondeErrJSON(t *testing.T) {
	w := httptest.NewRecorder()
	respondeErrJSON(w, noEncontrado("Ese equipo no existe."))
	if w.Code != http.StatusNotFound {
		t.Errorf("ErrJSON debería respetar su status, dio %d", w.Code)
	}

	w = httptest.NewRecorder()
	respondeErrJSON(w, errors.New("error de SQL"))
	if w.Code != http.StatusInternalServerError {
		t.Errorf("error genérico debería dar 500, dio %d", w.Code)
	}
	var cuerpo map[string]string
	json.Unmarshal(w.Body.Bytes(), &cuerpo)
	if cuerpo["error"] == "" || cuerpo["error"] == "error de SQL" {
		t.Errorf("el error interno no debería filtrar el mensaje original: %q", cuerpo["error"])
	}
}
