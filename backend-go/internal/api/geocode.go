package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

/* =========================================================
   GET /api/geocode?q=...  (sesión requerida)

   Autocompletado de ubicación para Crear partido. Es un
   proxy liviano a Nominatim (OpenStreetMap): gratis, sin
   clave y sin tarjeta. Si más adelante hay clave de Google
   Maps, el front usa esa y este camino queda de respaldo.

   Se guarda una caché en memoria para no repetir búsquedas
   ni abusar del servicio, que pide como máximo 1 consulta
   por segundo.
   ========================================================= */

const geocodeURL = "https://nominatim.openstreetmap.org/search"

type geocodeItem struct {
	Titulo    string  `json:"titulo"`
	Subtitulo string  `json:"subtitulo"`
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
}

// Caché simple de búsquedas con vida limitada.
type cacheGeo struct {
	mu    sync.Mutex
	datos map[string]cacheGeoItem
}

type cacheGeoItem struct {
	hasta time.Time
	items []geocodeItem
}

var geoCache = cacheGeo{datos: map[string]cacheGeoItem{}}

func (c *cacheGeo) ver(clave string) ([]geocodeItem, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.datos[clave]
	if !ok || time.Now().After(e.hasta) {
		delete(c.datos, clave)
		return nil, false
	}
	return e.items, true
}

func (c *cacheGeo) guardar(clave string, items []geocodeItem) {
	c.mu.Lock()
	defer c.mu.Unlock()
	// Si crece mucho, se limpia entera: es solo una ayuda,
	// no una base.
	if len(c.datos) > 500 {
		c.datos = map[string]cacheGeoItem{}
	}
	c.datos[clave] = cacheGeoItem{hasta: time.Now().Add(10 * time.Minute), items: items}
}

var geoClient = &http.Client{Timeout: 6 * time.Second}

// geolocalizar busca direcciones y lugares por el texto del usuario.
func (s *Server) geolocalizar(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) < 3 {
		JSON(w, http.StatusOK, []geocodeItem{})
		return
	}
	if len(q) > 120 {
		q = q[:120]
	}

	clave := strings.ToLower(q)
	if items, ok := geoCache.ver(clave); ok {
		JSON(w, http.StatusOK, items)
		return
	}

	u := geocodeURL + "?format=jsonv2&limit=5&addressdetails=1&accept-language=es&q=" +
		url.QueryEscape(q)

	ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		Error(w, http.StatusBadGateway, "No pudimos buscar la ubicación. Escribí la dirección a mano.")
		return
	}
	// Nominatim pide identificar quién consulta.
	req.Header.Set("User-Agent", "Convocados/1.0 (app de fútbol)")

	resp, err := geoClient.Do(req)
	if err != nil {
		Error(w, http.StatusBadGateway, "No pudimos buscar la ubicación. Escribí la dirección a mano.")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		Error(w, http.StatusBadGateway, "No pudimos buscar la ubicación. Escribí la dirección a mano.")
		return
	}

	var crudo []struct {
		DisplayName string `json:"display_name"`
		Lat         string `json:"lat"`
		Lon         string `json:"lon"`
		Name        string `json:"name"`
		Address     struct {
			HouseNumber   string `json:"house_number"`
			Road          string `json:"road"`
			Pedestrian    string `json:"pedestrian"`
			Neighbourhood string `json:"neighbourhood"`
			Suburb        string `json:"suburb"`
			City          string `json:"city"`
			Town          string `json:"town"`
			Village       string `json:"village"`
			Municipality  string `json:"municipality"`
		} `json:"address"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&crudo); err != nil {
		Error(w, http.StatusBadGateway, "No pudimos leer los resultados. Escribí la dirección a mano.")
		return
	}

	items := make([]geocodeItem, 0, len(crudo))
	for _, c := range crudo {
		lat, err1 := strconv.ParseFloat(c.Lat, 64)
		lng, err2 := strconv.ParseFloat(c.Lon, 64)
		if err1 != nil || err2 != nil {
			continue
		}
		calle := c.Address.Road
		if calle == "" {
			calle = c.Address.Pedestrian
		}
		ciudad := c.Address.City
		if ciudad == "" {
			ciudad = c.Address.Town
		}
		if ciudad == "" {
			ciudad = c.Address.Village
		}
		if ciudad == "" {
			ciudad = c.Address.Municipality
		}
		titulo, subtitulo := formatearLugar(geoLugar{
			Nombre:  strings.TrimSpace(c.Name),
			Calle:   strings.TrimSpace(calle),
			Numero:  strings.TrimSpace(c.Address.HouseNumber),
			Barrio:  primeraNoVacia(c.Address.Neighbourhood, c.Address.Suburb),
			Ciudad:  strings.TrimSpace(ciudad),
			Display: c.DisplayName,
		})
		items = append(items, geocodeItem{
			Titulo:    titulo,
			Subtitulo: subtitulo,
			Lat:       lat,
			Lng:       lng,
		})
	}
	geoCache.guardar(clave, items)
	JSON(w, http.StatusOK, items)
}

// geoLugar es lo que usamos de cada resultado para mostrarlo en la lista.
type geoLugar struct {
	Nombre  string
	Calle   string
	Numero  string
	Barrio  string
	Ciudad  string
	Display string
}

// formatearLugar arma el título y el subtítulo de una sugerencia:
//
//	"Honduras 5050" / "Palermo Soho, Buenos Aires"
//	"Club Palermo Soho" / "Honduras 5050, Palermo Soho, Buenos Aires"
func formatearLugar(g geoLugar) (string, string) {
	titulo := g.Nombre
	if titulo == "" {
		switch {
		case g.Calle != "" && g.Numero != "":
			titulo = g.Calle + " " + g.Numero
		case g.Calle != "":
			titulo = g.Calle
		default:
			titulo = strings.SplitN(g.Display, ", ", 2)[0]
		}
	}

	piezas := []string{}
	agregar := func(p string) {
		p = strings.TrimSpace(p)
		if p == "" || p == titulo {
			return
		}
		for _, ya := range piezas {
			if ya == p {
				return
			}
		}
		piezas = append(piezas, p)
	}

	// Si el lugar tiene nombre, la dirección va en el subtítulo
	if g.Nombre != "" {
		if g.Numero != "" {
			agregar(g.Calle + " " + g.Numero)
		} else {
			agregar(g.Calle)
		}
	}
	agregar(g.Barrio)
	agregar(g.Ciudad)

	if len(piezas) == 0 {
		if _, resto, ok := strings.Cut(g.Display, ", "); ok {
			return titulo, strings.TrimSpace(resto)
		}
		return titulo, ""
	}
	return titulo, strings.Join(piezas, ", ")
}

func primeraNoVacia(valores ...string) string {
	for _, v := range valores {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
