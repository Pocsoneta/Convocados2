package api

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
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

const (
	geocodeURL        = "https://nominatim.openstreetmap.org/search"
	geocodeReverseURL = "https://nominatim.openstreetmap.org/reverse"
)

type geocodeItem struct {
	Titulo    string  `json:"titulo"`
	Subtitulo string  `json:"subtitulo"`
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
	// Tipo es la clase del lugar según OpenStreetMap ("city", "town",
	// "house", "state"...). El front lo usa para preferir una ciudad al
	// centrar el mapa en la localidad del perfil (y no un centroide).
	Tipo string `json:"tipo"`
}

// geoDireccion es la parte de la respuesta de Nominatim que usamos
// para armar el título y el subtítulo de una sugerencia.
type geoDireccion struct {
	HouseNumber   string `json:"house_number"`
	Road          string `json:"road"`
	Pedestrian    string `json:"pedestrian"`
	Neighbourhood string `json:"neighbourhood"`
	Suburb        string `json:"suburb"`
	City          string `json:"city"`
	Town          string `json:"town"`
	Village       string `json:"village"`
	Municipality  string `json:"municipality"`
}

// geoCrudo es un resultado tal cual viene de Nominatim: lo mismo
// devuelve /search (uno por resultado) y /reverse (uno solo).
type geoCrudo struct {
	DisplayName string       `json:"display_name"`
	Lat         string       `json:"lat"`
	Lon         string       `json:"lon"`
	Name        string       `json:"name"`
	Addresstype string       `json:"addresstype"`
	Type        string       `json:"type"`
	Address     geoDireccion `json:"address"`
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

// Nominatim pide como máximo 1 consulta por segundo. El front ya lo
// respeta; acá lo garantizamos también del lado del servidor para no
// arriesgar un bloqueo por IP cuando entran varios pedidos a la vez.
var (
	geoMu        sync.Mutex
	geoUltima    time.Time
	geoIntervalo = time.Second
)

// esperarTurno reserva el próximo turno de consulta a Nominatim y espera
// lo necesario. Devuelve false si el contexto se canceló antes del turno.
func esperarTurno(ctx context.Context) bool {
	geoMu.Lock()
	espera := time.Until(geoUltima.Add(geoIntervalo))
	if espera < 0 {
		espera = 0
	}
	geoUltima = time.Now().Add(espera)
	geoMu.Unlock()

	if espera <= 0 {
		return true
	}
	t := time.NewTimer(espera)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

// consultarNominatim busca en Nominatim (OpenStreetMap) y devuelve las
// sugerencias ya normalizadas. Es el único lugar que habla con el
// servicio, y cachea por texto para no repetir consultas (Nominatim
// pide como máximo 1 por segundo). Lo usan el autocompletado del front
// y el alta de partidos con la ubicación escrita a mano.
func consultarNominatim(ctx context.Context, texto string, limite int) ([]geocodeItem, error) {
	texto = strings.TrimSpace(texto)
	if len(texto) < 3 {
		return []geocodeItem{}, nil
	}
	if len(texto) > 120 {
		texto = texto[:120]
	}
	if limite <= 0 {
		limite = 5
	}

	clave := strings.ToLower(texto)
	if items, ok := geoCache.ver(clave); ok {
		return items, nil
	}

	// Respetamos el límite de Nominatim (1 consulta por segundo).
	if !esperarTurno(ctx) {
		return nil, ctx.Err()
	}

	u := geocodeURL + "?format=jsonv2&limit=" + strconv.Itoa(limite) +
		"&addressdetails=1&accept-language=es&q=" + url.QueryEscape(texto)

	ctx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	// Nominatim pide identificar quién consulta.
	req.Header.Set("User-Agent", "Convocados/1.0 (app de fútbol)")

	resp, err := geoClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nominatim respondió %d", resp.StatusCode)
	}

	var crudo []geoCrudo
	if err := json.NewDecoder(resp.Body).Decode(&crudo); err != nil {
		return nil, err
	}

	items := make([]geocodeItem, 0, len(crudo))
	for _, c := range crudo {
		if item, ok := itemDe(c); ok {
			items = append(items, item)
		}
	}
	geoCache.guardar(clave, items)
	return items, nil
}

// coordenadasDeTexto resuelve una dirección escrita a mano con su
// primer resultado. Es best-effort: si no encuentra nada (o falla),
// devuelve ok=false y el complejo queda sin coordenadas.
func coordenadasDeTexto(ctx context.Context, texto string) (lat, lng float64, ok bool) {
	items, err := consultarNominatim(ctx, texto, 1)
	if err != nil || len(items) == 0 {
		return 0, 0, false
	}
	if !tieneUbicacion(items[0].Lat, items[0].Lng) {
		return 0, 0, false
	}
	return items[0].Lat, items[0].Lng, true
}

// geolocalizar busca direcciones y lugares por el texto del usuario.
func (s *Server) geolocalizar(w http.ResponseWriter, r *http.Request) {
	// ?lat=&lng= → ubicación inversa: le pasa las coordenadas al
	// punto que marcó el usuario en el mapa de Crear partido y le
	// devuelve la dirección que corresponde.
	if r.URL.Query().Get("lat") != "" && r.URL.Query().Get("lng") != "" {
		s.geolocalizarAlReves(w, r)
		return
	}

	items, err := consultarNominatim(r.Context(), r.URL.Query().Get("q"), 5)
	if err != nil {
		Error(w, http.StatusBadGateway, "No pudimos buscar la ubicación. Escribí la dirección a mano.")
		return
	}
	JSON(w, http.StatusOK, items)
}

// reverseCrudo pide a Nominatim la dirección de unas coordenadas y
// devuelve el resultado crudo. Es best-effort: ok=false si no hay nada
// (o si falla), y nunca corta al que la usa.
func reverseCrudo(ctx context.Context, lat, lng float64) (geoCrudo, bool) {
	if !tieneUbicacion(lat, lng) {
		return geoCrudo{}, false
	}

	// Respetamos el límite de Nominatim (1 consulta por segundo).
	if !esperarTurno(ctx) {
		return geoCrudo{}, false
	}

	u := geocodeReverseURL + "?format=jsonv2&zoom=18&accept-language=es&lat=" +
		strconv.FormatFloat(lat, 'f', 6, 64) +
		"&lon=" + strconv.FormatFloat(lng, 'f', 6, 64)

	ctx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return geoCrudo{}, false
	}
	req.Header.Set("User-Agent", "Convocados/1.0 (app de fútbol)")

	resp, err := geoClient.Do(req)
	if err != nil {
		return geoCrudo{}, false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return geoCrudo{}, false
	}

	var crudo geoCrudo
	if err := json.NewDecoder(resp.Body).Decode(&crudo); err != nil {
		return geoCrudo{}, false
	}
	return crudo, true
}

// ciudadDe saca la ciudad/pueblo/partido de un resultado de Nominatim.
func ciudadDe(c geoCrudo) string {
	for _, v := range []string{c.Address.City, c.Address.Town, c.Address.Village, c.Address.Municipality} {
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
	}
	return ""
}

// ciudadDeCoords resuelve la ciudad de unas coordenadas con el reverse de
// Nominatim. Devuelve "" si no se pudo determinar: nunca inventa "CABA".
func ciudadDeCoords(ctx context.Context, lat, lng float64) string {
	c, ok := reverseCrudo(ctx, lat, lng)
	if !ok {
		return ""
	}
	return ciudadDe(c)
}

// geolocalizarAlReves es GET /api/geocode?lat=..&lng=..: convierte un
// punto del mapa en una dirección legible. Es el camino inverso del
// autocompletado y lo usa el mapa de Crear partido.
func (s *Server) geolocalizarAlReves(w http.ResponseWriter, r *http.Request) {
	lat, err1 := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lng, err2 := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
	if err1 != nil || err2 != nil || math.Abs(lat) > 90 || math.Abs(lng) > 180 {
		Error(w, http.StatusBadRequest, "Las coordenadas no son válidas.")
		return
	}

	// Se redondea a 5 decimales (~1 m): el punto exacto donde se
	// tocó el mapa no cambia y así no repetimos la consulta.
	clave := "rev:" + strconv.FormatFloat(lat, 'f', 5, 64) + "," + strconv.FormatFloat(lng, 'f', 5, 64)
	if items, ok := geoCache.ver(clave); ok {
		JSON(w, http.StatusOK, items)
		return
	}

	// Sin dirección no se corta nada: devolvemos una lista vacía.
	items := []geocodeItem{}
	if crudo, ok := reverseCrudo(r.Context(), lat, lng); ok {
		if item, ok := itemDe(crudo); ok {
			items = append(items, item)
		}
	}
	geoCache.guardar(clave, items)
	JSON(w, http.StatusOK, items)
}

// itemDe pasa un resultado de Nominatim a lo que muestra el front.
// Devuelve false si las coordenadas no se pueden leer.
func itemDe(c geoCrudo) (geocodeItem, bool) {
	lat, err1 := strconv.ParseFloat(c.Lat, 64)
	lng, err2 := strconv.ParseFloat(c.Lon, 64)
	if err1 != nil || err2 != nil {
		return geocodeItem{}, false
	}

	calle := c.Address.Road
	if calle == "" {
		calle = c.Address.Pedestrian
	}
	ciudad := ciudadDe(c)
	titulo, subtitulo := formatearLugar(geoLugar{
		Nombre:  strings.TrimSpace(c.Name),
		Calle:   strings.TrimSpace(calle),
		Numero:  strings.TrimSpace(c.Address.HouseNumber),
		Barrio:  primeraNoVacia(c.Address.Neighbourhood, c.Address.Suburb),
		Ciudad:  strings.TrimSpace(ciudad),
		Display: c.DisplayName,
	})
	tipo := c.Addresstype
	if tipo == "" {
		tipo = c.Type
	}
	return geocodeItem{
		Titulo:    titulo,
		Subtitulo: subtitulo,
		Lat:       lat,
		Lng:       lng,
		Tipo:      tipo,
	}, true
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
