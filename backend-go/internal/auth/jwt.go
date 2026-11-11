// Package auth maneja contraseñas, tokens JWT y el middleware de sesión.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Claims = datos del usuario dentro del token.
type Claims struct {
	Sub    int64  `json:"sub"` // id_usuario
	Email  string `json:"email"`
	Nombre string `json:"nombre"`
	Iat    int64  `json:"iat"`
	Exp    int64  `json:"exp"`
}

var (
	ErrTokenInvalido = errors.New("token inválido o vencido")
)

// Sign firma un token JWT (HS256) a medida.
func Sign(secreto string, ttl time.Duration, c Claims) (string, error) {
	ahora := time.Now()
	if c.Iat == 0 {
		c.Iat = ahora.Unix()
	}
	if c.Exp == 0 {
		c.Exp = ahora.Add(ttl).Unix()
	}

	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload, err := json.Marshal(c)
	if err != nil {
		return "", err
	}
	body := header + "." + base64.RawURLEncoding.EncodeToString(payload)
	firma, err := firmar(secreto, body)
	if err != nil {
		return "", err
	}
	return body + "." + firma, nil
}

// Parse valida firma y vencimiento.
func Parse(secreto, token string) (*Claims, error) {
	parte := strings.Split(token, ".")
	if len(parte) != 3 {
		return nil, ErrTokenInvalido
	}
	firma, err := firmar(secreto, parte[0]+"."+parte[1])
	if err != nil {
		return nil, err
	}
	if !hmac.Equal([]byte(firma), []byte(parte[2])) {
		return nil, ErrTokenInvalido
	}

	datos, err := base64.RawURLEncoding.DecodeString(parte[1])
	if err != nil {
		return nil, ErrTokenInvalido
	}
	var c Claims
	if err := json.Unmarshal(datos, &c); err != nil {
		return nil, ErrTokenInvalido
	}
	if c.Sub == 0 {
		return nil, ErrTokenInvalido
	}
	if time.Now().Unix() > c.Exp {
		return nil, ErrTokenInvalido
	}
	return &c, nil
}

func firmar(secreto, dato string) (string, error) {
	h := hmac.New(sha256.New, []byte(secreto))
	if _, err := h.Write([]byte(dato)); err != nil {
		return "", fmt.Errorf("firmando: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil)), nil
}

// SecretoAleatorio devuelve un secreto de 32 bytes en base64url
// (útil para generar JWT_SECRET la primera vez).
func SecretoAleatorio() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "convocados-secret-no-aleatorio"
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
