package auth

import (
	"errors"
	"strings"
	"testing"
	"time"
)

const secretoTest = "secreto-para-tests"

func claimsPrueba() Claims {
	return Claims{Sub: 7, Email: "qa@correo.test", Nombre: "Qa"}
}

// Firmar y volver a leer devuelve los mismos datos.
func TestSignParseRoundtrip(t *testing.T) {
	token, err := Sign(secretoTest, time.Hour, claimsPrueba())
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	c, err := Parse(secretoTest, token)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if c.Sub != 7 || c.Email != "qa@correo.test" || c.Nombre != "Qa" {
		t.Errorf("claims no sobreviven la vuelta: %+v", c)
	}
	if c.Exp <= c.Iat {
		t.Errorf("exp (%d) debería ser posterior a iat (%d)", c.Exp, c.Iat)
	}
}

// Si alguien toca el payload, la firma no tiene que validar.
func TestParseTokenAlterado(t *testing.T) {
	token, _ := Sign(secretoTest, time.Hour, claimsPrueba())
	partes := strings.Split(token, ".")
	otro := partes[0] + ".eyJzdWIiOjk5fQ." + partes[2] // otro payload, misma firma
	if _, err := Parse(secretoTest, otro); !errors.Is(err, ErrTokenInvalido) {
		t.Errorf("un token alterado debería dar ErrTokenInvalido, dio: %v", err)
	}
}

// Un token firmado con otro secreto no valida.
func TestParseSecretoDistinto(t *testing.T) {
	token, _ := Sign("otro-secreto", time.Hour, claimsPrueba())
	if _, err := Parse(secretoTest, token); !errors.Is(err, ErrTokenInvalido) {
		t.Errorf("token con otro secreto debería dar ErrTokenInvalido, dio: %v", err)
	}
}

// Un token vencido no valida.
func TestParseTokenVencido(t *testing.T) {
	c := claimsPrueba()
	c.Iat = time.Now().Add(-2 * time.Hour).Unix()
	c.Exp = time.Now().Add(-time.Hour).Unix() // ya venció
	token, _ := Sign(secretoTest, 0, c)
	if _, err := Parse(secretoTest, token); !errors.Is(err, ErrTokenInvalido) {
		t.Errorf("token vencido debería dar ErrTokenInvalido, dio: %v", err)
	}
}

// Formatos podridos no validan (y no entran en pánico).
func TestParseBasura(t *testing.T) {
	casos := []string{"", "un-tramo", "dos.tramos", "a.b.c.d", "x.y.z"}
	for _, token := range casos {
		if _, err := Parse(secretoTest, token); !errors.Is(err, ErrTokenInvalido) {
			t.Errorf("token %q debería dar ErrTokenInvalido, dio: %v", token, err)
		}
	}
}

// Sin sub (usuario) no hay sesión que valga.
func TestParseSinSub(t *testing.T) {
	c := Claims{Email: "sin-id@correo.test"} // Sub == 0
	token, _ := Sign(secretoTest, time.Hour, c)
	if _, err := Parse(secretoTest, token); !errors.Is(err, ErrTokenInvalido) {
		t.Errorf("token sin sub debería dar ErrTokenInvalido, dio: %v", err)
	}
}

// SecretoAleatorio genera secretos distintos entre llamadas y sirven
// para firmar/leer tokens.
func TestSecretoAleatorio(t *testing.T) {
	s1 := SecretoAleatorio()
	s2 := SecretoAleatorio()
	if s1 == "" || s2 == "" {
		t.Fatal("SecretoAleatorio devolvió cadena vacía")
	}
	if s1 == s2 {
		t.Error("dos secretos aleatorios resultaron iguales")
	}
	token, err := Sign(s1, time.Minute, claimsPrueba())
	if err != nil {
		t.Fatalf("Sign con secreto aleatorio: %v", err)
	}
	if _, err := Parse(s1, token); err != nil {
		t.Errorf("Parse con el mismo secreto aleatorio: %v", err)
	}
}
