package auth

import "testing"

// El hash tiene que verificar con la clave correcta y fallar con otra.
func TestVerificarPassword(t *testing.T) {
	hash, err := HashearPassword("clave-de-prueba-1")
	if err != nil {
		t.Fatalf("HashearPassword: %v", err)
	}
	if !VerificarPassword(hash, "clave-de-prueba-1") {
		t.Error("la clave correcta no verifica contra su hash")
	}
	if VerificarPassword(hash, "clave-incorrecta") {
		t.Error("la clave incorrecta verifica contra el hash: bug grave")
	}
}

// bcrypt mete una sal distinta en cada hash: dos hashes de la misma
// clave no tienen que ser iguales (pero ambos tienen que verificar).
func TestHashearPasswordSalDistinta(t *testing.T) {
	h1, err := HashearPassword("la-misma-clave")
	if err != nil {
		t.Fatalf("HashearPassword: %v", err)
	}
	h2, err := HashearPassword("la-misma-clave")
	if err != nil {
		t.Fatalf("HashearPassword: %v", err)
	}
	if h1 == h2 {
		t.Error("dos hashes de la misma clave resultaron idénticos: falta la sal")
	}
	if !VerificarPassword(h1, "la-misma-clave") || !VerificarPassword(h2, "la-misma-clave") {
		t.Error("alguno de los dos hashes no verifica")
	}
}
