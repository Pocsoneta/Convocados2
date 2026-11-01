package auth

import "golang.org/x/crypto/bcrypt"

// Costo 10: equilibrio razonable entre seguridad y velocidad en local.
const costo = 10

// HashearPassword genera el hash bcrypt de la contraseña.
func HashearPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), costo)
	return string(b), err
}

// VerificarPassword compara la contraseña en claro con el hash guardado.
func VerificarPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
