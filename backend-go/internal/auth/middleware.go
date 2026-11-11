package auth

import (
	"context"
	"net/http"
	"time"
)

// Cookie de sesión: httpOnly (el JS del front no la lee) + SameSite=Lax
// para que funcione al servir el front desde este mismo servidor.
const (
	NombreCookie = "convocados_token"
	RutaCookie   = "/"
)

type ctxKey int

const claimsKey ctxKey = 1

// GuardarSesión escribe la cookie con el token.
func GuardarSesión(w http.ResponseWriter, secreto string, ttl time.Duration, sub int64, email, nombre string) error {
	token, err := Sign(secreto, ttl, Claims{Sub: sub, Email: email, Nombre: nombre})
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     NombreCookie,
		Value:    token,
		Path:     RutaCookie,
		MaxAge:   int(ttl.Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false, // true cuando corra por HTTPS
	})
	return nil
}

// BorrarSesión elimina la cookie.
func BorrarSesión(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     NombreCookie,
		Value:    "",
		Path:     RutaCookie,
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

// ConClaims devuelve las claims guardadas en el contexto (o nil).
func ConClaims(r *http.Request) *Claims {
	c, _ := r.Context().Value(claimsKey).(*Claims)
	return c
}

// ExigeSesión deja pasar solo con cookie válida; si no, responde 401.
// (Se puede montar en rutas concretas además del chequeo general de /api.)
func ExigeSesión(siguiente http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ConClaims(r) == nil {
			http.Error(w, `{"error":"Sesión inválida o vencida."}`, http.StatusUnauthorized)
			return
		}
		siguiente.ServeHTTP(w, r)
	})
}

// Middleware resuelve las claims a partir de la cookie y las deja en el contexto.
func Middleware(secreto string, siguiente http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(NombreCookie)
		if err == nil && cookie.Value != "" {
			if claims, err := Parse(secreto, cookie.Value); err == nil {
				r = r.WithContext(context.WithValue(r.Context(), claimsKey, claims))
			}
		}
		siguiente.ServeHTTP(w, r)
	})
}
