package api

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"convocados/internal/auth"
	"convocados/internal/config"
)

/* =========================================================
   Server agrupa lo que necesitan todos los handlers.
   ========================================================= */

type Server struct {
	DB  *sql.DB
	Cfg *config.Config
}

/* =========================================================
   Armado de rutas.
   - /api/auth/registro, /api/auth/login y /api/health son públicas.
   - Todo lo demás bajo /api exige cookie de sesión.
   - El resto de las rutas sirve los archivos del front.
   ========================================================= */

func (s *Server) Router() http.Handler {
	raiz := http.NewServeMux()

	// --- Públicas ---
	raiz.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		JSON(w, http.StatusOK, map[string]string{"ok": "Convocados API"})
	})
	raiz.HandleFunc("POST /api/auth/registro", s.registrar)
	raiz.HandleFunc("POST /api/auth/login", s.login)

	// --- Protegidas ---
	protegido := http.NewServeMux()

	protegido.HandleFunc("POST /api/auth/logout", s.logout)
	protegido.HandleFunc("GET /api/auth/me", s.me)

	protegido.HandleFunc("GET /api/perfil", s.obtenerPerfil)
	protegido.HandleFunc("PUT /api/perfil", s.guardarPerfil)
	protegido.HandleFunc("PUT /api/cuenta", s.guardarCuenta)

	protegido.HandleFunc("GET /api/inicio/cercanos", s.cercanos)
	protegido.HandleFunc("GET /api/inicio/proximo", s.proximoPartido)
	protegido.HandleFunc("GET /api/inicio/conteos", s.conteoModalidades)

	protegido.HandleFunc("GET /api/partidos", s.listarPartidos)
	protegido.HandleFunc("POST /api/partidos", s.crearPartido)
	protegido.HandleFunc("GET /api/partidos/{id}", s.detallePartido)
	protegido.HandleFunc("POST /api/partidos/{id}/inscripcion", s.inscribirse)
	protegido.HandleFunc("DELETE /api/partidos/{id}/inscripcion", s.desinscribirse)
	protegido.HandleFunc("POST /api/partidos/{id}/equipos", s.sumarEquipo)
	protegido.HandleFunc("DELETE /api/partidos/{id}/equipos/{equipo}", s.bajarEquipo)

	protegido.HandleFunc("GET /api/mis-partidos", s.misPartidos)

	protegido.HandleFunc("GET /api/complejos", s.listarComplejos)
	protegido.HandleFunc("POST /api/complejos", s.crearComplejo)
	protegido.HandleFunc("GET /api/complejos/{id}/canchas", s.canchasDeComplejo)

	protegido.HandleFunc("GET /api/equipos", s.listarEquipos)
	protegido.HandleFunc("GET /api/equipos/mis-equipos", s.misEquipos)
	protegido.HandleFunc("POST /api/equipos", s.crearEquipo)
	protegido.HandleFunc("GET /api/equipos/{id}", s.detalleEquipo)
	protegido.HandleFunc("POST /api/equipos/{id}/integrantes", s.sumarIntegrante)
	protegido.HandleFunc("DELETE /api/equipos/{id}/integrantes/{usuario}", s.quitarIntegrante)

	protegido.HandleFunc("GET /api/usuarios/{id}", s.usuarioPublicoDetalle)

	// Cualquier otra ruta /api/* sin sesión responde 401;
	// con sesión, 404 en JSON.
	protegido.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		if auth.ConClaims(r) == nil {
			Error(w, http.StatusUnauthorized, "Sesión inválida o vencida.")
			return
		}
		Error(w, http.StatusNotFound, "No existe ese recurso.")
	})

	raiz.Handle("/api/", requiereSesión(protegido))

	// --- Archivos estáticos del front ---
	if s.Cfg.FrontDir != "" {
		if info, err := os.Stat(s.Cfg.FrontDir); err == nil && info.IsDir() {
			raiz.Handle("/", archivosFront(s.Cfg.FrontDir))
		} else {
			log.Printf("FRONT_DIR %q no existe: sirvo solo la API", s.Cfg.FrontDir)
			raiz.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
				Error(w, http.StatusNotFound,
					"Acá corre solo la API. Seteá FRONT_DIR con la carpeta del front para servirlo también.")
			})
		}
	} else {
		log.Print("sin FRONT_DIR: la API corre sin archivos estáticos")
		raiz.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			Error(w, http.StatusNotFound,
				"Acá corre solo la API. Seteá FRONT_DIR con la carpeta del front para servirlo también.")
		})
	}

	return conCORS(s.Cfg.AllowOrigin, auth.Middleware(s.Cfg.JWTSecret, raiz))
}

// requiereSesión corta con 401 si no hay claims.
func requiereSesión(siguiente http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if auth.ConClaims(r) == nil {
			Error(w, http.StatusUnauthorized, "Sesión inválida o vencida.")
			return
		}
		siguiente.ServeHTTP(w, r)
	})
}

// archivosFront sirve el HTML/CSS/JS del front desde esta misma app
// (así las cookies de sesión funcionan sin CORS).
func archivosFront(dir string) http.Handler {
	abs, err := filepath.Abs(dir)
	if err != nil {
		abs = dir
	}
	base := http.FileServer(http.Dir(abs))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// índice por defecto
		if r.URL.Path == "/" {
			r.URL.Path = "/inicio.html"
		}
		// caché corta en desarrollo
		w.Header().Set("Cache-Control", "no-cache")
		base.ServeHTTP(w, r)
	})
}

// conCORS solo si se habilita explicitamente (útil cuando el front
// se sirve desde otro puerto, por ejemplo el Live Server).
func conCORS(origen string, siguiente http.Handler) http.Handler {
	if strings.TrimSpace(origen) == "" {
		return siguiente
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origen)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		siguiente.ServeHTTP(w, r)
	})
}
