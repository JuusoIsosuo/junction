# Build native Word document for AI2PB Map documentation (English)
$ErrorActionPreference = "Stop"

$outPath = "C:\Users\Omistaja\Koulu\Junction3\junction\ai2pb-map\AI2PB_Map_Documentation.docx"

# Constants
$wdAlignLeft = 0
$wdAlignCenter = 1
$wdPageBreak = 7
$wdStory = 6
$wdFormatDocumentDefault = 16

Write-Host "Starting Word..."
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Add()
    $sel = $word.Selection

    # ── Helpers ─────────────────────────────────────────────────
    $script:bulletCounter = 0

    function Reset-Formatting {
        $sel.Font.Name = "Calibri"
        $sel.Font.Size = 11
        $sel.Font.Bold = $false
        $sel.Font.Italic = $false
        $sel.Font.Color = 0
        $sel.ParagraphFormat.Alignment = $wdAlignLeft
        $sel.ParagraphFormat.LeftIndent = 0
        $sel.ParagraphFormat.SpaceAfter = 6
    }

    function Add-Heading($text, $level) {
        Reset-Formatting
        switch ($level) {
            1 { $sel.Font.Size = 20; $sel.Font.Bold = $true; $sel.Font.Color = 6178128; $sel.ParagraphFormat.SpaceBefore = 18 }
            2 { $sel.Font.Size = 14; $sel.Font.Bold = $true; $sel.Font.Color = 6178128; $sel.ParagraphFormat.SpaceBefore = 12 }
            3 { $sel.Font.Size = 12; $sel.Font.Bold = $true; $sel.Font.Color = 8740696; $sel.ParagraphFormat.SpaceBefore = 8 }
        }
        $sel.TypeText($text)
        $sel.TypeParagraph()
        Reset-Formatting
    }

    function Add-Paragraph($text) {
        Reset-Formatting
        $sel.TypeText($text)
        $sel.TypeParagraph()
    }

    function Add-Bullet($text) {
        Reset-Formatting
        $sel.ParagraphFormat.LeftIndent = 18
        $sel.TypeText([char]0x2022 + "  " + $text)
        $sel.TypeParagraph()
    }

    function Add-Numbered($text) {
        Reset-Formatting
        $script:bulletCounter++
        $sel.ParagraphFormat.LeftIndent = 18
        $sel.TypeText("$script:bulletCounter.  $text")
        $sel.TypeParagraph()
    }

    function End-List {
        $script:bulletCounter = 0
        Reset-Formatting
    }

    function Add-PageBreak {
        $sel.InsertBreak($wdPageBreak)
    }

    function Add-Table($headers, $rows) {
        $cols = $headers.Count
        $rowCount = $rows.Count + 1
        $range = $sel.Range
        $table = $doc.Tables.Add($range, $rowCount, $cols)
        $table.Borders.Enable = $true
        $table.PreferredWidthType = 2
        $table.PreferredWidth = 100

        for ($c = 0; $c -lt $cols; $c++) {
            $cell = $table.Cell(1, $c + 1)
            $cell.Range.Text = $headers[$c]
            $cell.Range.Bold = $true
            $cell.Range.Font.Color = 16777215
            $cell.Shading.BackgroundPatternColor = 6178128
        }

        for ($r = 0; $r -lt $rows.Count; $r++) {
            for ($c = 0; $c -lt $cols; $c++) {
                $table.Cell($r + 2, $c + 1).Range.Text = $rows[$r][$c]
            }
        }

        $word.Selection.EndKey($wdStory) | Out-Null
        $sel.TypeParagraph()
    }

    # ── COVER ───────────────────────────────────────────────────
    $sel.ParagraphFormat.Alignment = $wdAlignCenter
    $sel.Font.Size = 28
    $sel.Font.Bold = $true
    $sel.Font.Color = 6178128
    $sel.TypeText("AI2PB Map")
    $sel.TypeParagraph()

    $sel.Font.Size = 14
    $sel.Font.Bold = $false
    $sel.Font.Color = 6710886
    $sel.TypeText("Military Terrain and Intelligence Analysis Tool")
    $sel.TypeParagraph()
    $sel.TypeParagraph()

    $sel.Font.Size = 11
    $sel.Font.Color = 0
    $sel.TypeText("Version 1.0   |   May 2026")
    $sel.TypeParagraph()
    $sel.TypeText("Junction Hackathon   |   Juuso Isosuo")
    $sel.TypeParagraph()

    $sel.ParagraphFormat.Alignment = $wdAlignLeft
    $sel.Font.Size = 11
    Add-PageBreak

    # ── TOC ─────────────────────────────────────────────────────
    Add-Heading "Table of Contents" 1
    Add-Numbered "Overview"
    Add-Numbered "Technical Stack"
    Add-Numbered "User Guide"
    Add-Numbered "Features"
    Add-Numbered "External APIs"
    Add-Numbered "Software Architecture"
    Add-Numbered "Backend Server"
    End-List
    Add-PageBreak

    # ── 1. OVERVIEW ─────────────────────────────────────────────
    Add-Heading "1. Overview" 1
    Add-Paragraph "AI2PB Map is a browser-based map and situational awareness application designed to support tactical area analysis. It combines satellite imagery, open data sources, and AI analysis into a single interface. The tool allows rapid analysis of any geographic area's infrastructure, population, terrain, and conditions."

    Add-Heading "Primary Use Case" 2
    Add-Paragraph "Tactical area analysis — covering infrastructure, movement obstacles, line of sight, drone operation weather assessment, and population density within a user-drawn area."

    Add-Heading "Key Features" 2
    Add-Bullet "Freehand area selection on the map"
    Add-Bullet "Automatic infrastructure data fetching (roads, bridges, buildings, cell towers, etc.)"
    Add-Bullet "Population density visualization (Statistics Finland 2022, 250m resolution in Finland)"
    Add-Bullet "Elevation heatmap and contour lines"
    Add-Bullet "Line of Sight (LoS) analysis accounting for buildings, terrain, and forests"
    Add-Bullet "Real-time weather data and drone flight assessment (5 drone types)"
    Add-Bullet "24-hour hourly drone forecast"
    Add-Bullet "AI-driven terrain analysis"
    End-List
    Add-PageBreak

    # ── 2. TECHNICAL STACK ──────────────────────────────────────
    Add-Heading "2. Technical Stack" 1

    Add-Heading "Technologies Used" 2
    Add-Table @("Component","Technology","Notes") @(
        @("Frontend framework","React 19","Hooks-based"),
        @("Map library","Mapbox GL JS 3.23","Satellite imagery base"),
        @("Area drawing","Mapbox GL Draw","Polygon drawing"),
        @("Build tool","Vite","Development and production build"),
        @("Backend server","Node.js + Express","Port 5174, CORS proxy")
    )

    Add-Heading "External Data Sources" 2
    Add-Table @("Service","Purpose","Protocol") @(
        @("OpenStreetMap / Overpass","Buildings, roads, bridges, infrastructure, military, nature","REST POST"),
        @("OpenCelliD","Mobile network cell towers","REST GET"),
        @("Open-Meteo","Weather data and elevation","REST GET"),
        @("Statistics Finland WFS","Population grid 2022","WFS 2.0"),
        @("Confidential Mind","AI analysis, OpenAI-compatible","REST POST")
    )
    Add-PageBreak

    # ── 3. USER GUIDE ───────────────────────────────────────────
    Add-Heading "3. User Guide" 1

    Add-Heading "Starting the Application" 2
    Add-Numbered "Start backend server: node server/index.js"
    Add-Numbered "Start frontend: npm run dev"
    Add-Numbered "Open browser: http://localhost:5173"
    End-List

    Add-Heading "Typical Workflow" 2
    Add-Numbered "Paint Area — draw an analysis polygon on the map"
    Add-Numbered "Gather Intel — load all data layers for the area"
    Add-Numbered "Review information in the left panel and right sidebar"
    Add-Numbered "Toggle desired map layers on/off using the Layers panel"
    Add-Numbered "Use specialized tools as needed (LoS, Weather, Drone, AI)"
    End-List

    Add-Paragraph "Note: AI analysis requires environment variables CONFIDENTIAL_MIND_BASE_URL and CONFIDENTIAL_MIND_API_KEY in the server .env file."
    Add-PageBreak

    # ── 4. FEATURES ─────────────────────────────────────────────
    Add-Heading "4. Features" 1

    Add-Heading "4.1 Area Selection (Paint Area)" 2
    Add-Paragraph "The core tool of the application. The user draws a freeform polygon on the map that defines the analysis area. All other features operate within this boundary."
    Add-Bullet "Click Paint Area to start drawing"
    Add-Bullet "Click on the map to place polygon points"
    Add-Bullet "Double-click to close the polygon"
    Add-Bullet "Coordinates can be copied as JSON via the Copy JSON button"
    Add-Bullet "Clear removes the area and resets all data"
    End-List

    Add-Heading "4.2 Intel Gathering (Gather Intel)" 2
    Add-Paragraph "Gather Intel triggers parallel data fetching from all sources. Results appear in the right sidebar panel."
    Add-Table @("Section","Source","Displayed Data") @(
        @("Population","Statistics Finland / OSM","Total population, gender split, age distribution"),
        @("Cell Towers","OpenCelliD","Tower locations and coverage circles"),
        @("Roads","OpenStreetMap","Road classification and lengths"),
        @("Bridges","OpenStreetMap","Bridges with weight limits"),
        @("Infrastructure","OpenStreetMap","Power plants, hospitals, factories"),
        @("Military","OpenStreetMap","Bases, bunkers, airfields, depots"),
        @("Buildings","OpenStreetMap","Building footprints"),
        @("Elevation","Open-Meteo","10x10 elevation grid points")
    )

    Add-Heading "4.3 Map Layers" 2
    Add-Paragraph "Each data type is its own map layer. Toggling a layer off hides both the map visualization and the corresponding section in the info panel."
    Add-Table @("Layer","Visualization") @(
        @("Cell Towers","Red dots and coverage circles"),
        @("Roads","Blue road network, classified by type"),
        @("Bridges","Orange highlighting"),
        @("Infrastructure","Yellow points for critical sites"),
        @("Military","Green military sites"),
        @("Buildings","Purple building footprints"),
        @("Nature","Light green for forests, water, parks"),
        @("Elevation","Yellow elevation heatmap and contours"),
        @("Population","Orange population density grid")
    )
    Add-PageBreak

    Add-Heading "4.4 Population Density" 2
    Add-Paragraph "Visualizes population distribution as a choropleth grid. In Finland, Statistics Finland's 250m x 250m grid is used; elsewhere, OpenStreetMap place nodes (cities, towns, villages) are used."
    Add-Paragraph "Coloring is relative — each area is normalized to its own maximum value, so concentration differences appear clearly in both dense urban and sparse rural areas."
    Add-Table @("Color","Meaning") @(
        @("Light yellow","Very low population (2-15 % of area max)"),
        @("Yellow","Low population (15-35 %)"),
        @("Orange","Moderate density (35-60 %)"),
        @("Red","High density (60-85 %)"),
        @("Dark red","Very high density (85-100 % — densest cells)")
    )
    Add-Paragraph "Clicking a cell on the map shows that cell's resident count in a popup. The info panel also displays total population, gender split, and age distribution."

    Add-Heading "4.5 Elevation" 2
    Add-Paragraph "Fetches 100 elevation points (10x10 grid) from Open-Meteo and visualizes them in two ways:"
    Add-Bullet "Heatmap — continuous color gradient: low values blue/purple, high values yellow/red"
    Add-Bullet "Contour lines — automatic lines at suitable intervals (10-100 m depending on range)"
    End-List
    Add-Paragraph "The info panel shows minimum, maximum, and median elevation. Elevation data is required for Line of Sight analysis."

    Add-Heading "4.6 Line of Sight (LoS)" 2
    Add-Paragraph "Calculates which points within the area have direct line of sight to a chosen observer point. The analysis computes 160 x 160 = 25,600 visibility points."
    Add-Paragraph "Usage: gather intel first, click Line of Sight, click an observer point on the map, wait for the computation to complete."
    Add-Table @("Color","Meaning") @(
        @("Green","Full visibility to the point"),
        @("Yellow-green","Good visibility"),
        @("Yellow","Partial visibility (through forest)"),
        @("Orange","Weak visibility"),
        @("Red","No visibility (buildings or terrain block)")
    )
    Add-Paragraph "Obstacle handling:"
    Add-Bullet "Buildings — full blocking. Height from height tag or building:levels * 3m (default 8m)"
    Add-Bullet "Terrain — 30 sample points along the ray, 3m tolerance for DEM inaccuracy"
    Add-Bullet "Forests — partial blocking; each crossed forest reduces visibility by 40 %"
    End-List
    Add-PageBreak

    Add-Heading "4.7 Weather" 2
    Add-Paragraph "Opens a floating panel showing real-time weather for the area center. The panel is draggable and minimizable."
    Add-Paragraph "Current conditions: temperature, wind speed and direction, gusts, humidity, dew point, visibility, pressure, cloud cover, and precipitation."
    Add-Paragraph "48-hour hourly forecast: per-hour predictions for two days covering all the same variables plus precipitation probability."

    Add-Heading "4.8 Drone Assessment" 2
    Add-Paragraph "Evaluates flight feasibility for five drone types under current conditions and across a 24-hour hourly forecast."
    Add-Table @("Type","Example","Max Wind","Max Gust","Waterproof") @(
        @("Micro","DJI Mini 4 Pro","8 m/s","10 m/s","No"),
        @("Consumer","DJI Mavic 3","12 m/s","14 m/s","No"),
        @("Professional","DJI Matrice 30T","15 m/s","18 m/s","Yes"),
        @("Military UAV","Tactical fixed-rotor","20 m/s","25 m/s","Yes"),
        @("Fixed Wing","Long-range ISR UAV","18 m/s","22 m/s","No")
    )
    Add-Paragraph "Assessment criteria: wind speed, gusts, temperature, precipitation (WMO weather code), dew point gap, humidity, visibility, and air pressure."
    Add-Table @("Status","Meaning") @(
        @("GO (green)","All parameters within limits"),
        @("CAUTION (yellow)","Some parameter near limit or minor risk factor"),
        @("NO-GO (red)","At least one parameter beyond limits")
    )
    Add-Paragraph "The bottom of the panel shows a 24h hourly forecast — a scrollable matrix with drone types as rows and hours as columns. Each cell is color-coded by GO/CAUTION/NO-GO status."

    Add-Heading "4.9 AI Analysis" 2
    Add-Paragraph "Sends a condensed summary of the area's OSM data to an AI model and returns a short tactical assessment. Requires Gather Intel to be run first."
    Add-Paragraph "Report structure:"
    Add-Bullet "Chokepoints — movement bottlenecks"
    Add-Bullet "Barriers — water bodies, forests, terrain obstacles"
    Add-Bullet "Key roads — critical road corridors"
    Add-Bullet "Notable features — other notable points of interest"
    End-List
    Add-PageBreak

    # ── 5. APIS ─────────────────────────────────────────────────
    Add-Heading "5. External APIs" 1

    Add-Heading "Open-Meteo — Weather" 2
    Add-Paragraph "Endpoint: https://api.open-meteo.com/v1/forecast"
    Add-Paragraph "Fetches current weather and 48h hourly forecast. Wind speed in m/s. Includes temperature, humidity, dew point, precipitation, weather code, wind speed and direction, gusts, pressure, cloud cover, and visibility."

    Add-Heading "Open-Meteo — Elevation" 2
    Add-Paragraph "Endpoint: https://api.open-meteo.com/v1/elevation"
    Add-Paragraph "100 elevation points in a 10x10 grid, returned in meters above sea level."

    Add-Heading "Overpass API — OpenStreetMap" 2
    Add-Paragraph "Endpoint: https://overpass-api.de/api/interpreter (POST)"
    Add-Paragraph "Fetches all buildings, natural features, roads, bridges, infrastructure, and military sites within the bounding box. Response: GeoJSON geometries with tags."

    Add-Heading "Statistics Finland WFS — Population Grid" 2
    Add-Paragraph "Endpoint: https://geo.stat.fi/geoserver/vaestoruutu/wfs"
    Add-Table @("Parameter","Value") @(
        @("Primary layer","vaestoruutu:vaki2022_250m (250m grid)"),
        @("Fallback layer","vaestoruutu:vaki2022_1km (1km grid)"),
        @("Coordinate system","EPSG:4326 (WGS84)"),
        @("Population field","vaesto (residents per cell)"),
        @("Data year","2022")
    )
    Add-Paragraph "Used only when the analysis area is inside Finland's bounds."
    Add-PageBreak

    # ── 6. ARCHITECTURE ─────────────────────────────────────────
    Add-Heading "6. Software Architecture" 1

    Add-Heading "Directory Structure" 2
    Add-Table @("Path","Contents") @(
        @("src/app/App.jsx","Main component — state, effects, map init"),
        @("src/features/","One subfolder per feature"),
        @("src/features/[name]/[name]Layer.js","Mapbox GL layer functions"),
        @("src/features/intel/IntelPanel.jsx","Right-side info panel"),
        @("src/features/layers/LayerPanel.jsx","Layer toggle panel"),
        @("src/features/drone/DronePanel.jsx","Drone assessment panel"),
        @("src/features/weather/WeatherPanel.jsx","Weather panel"),
        @("src/features/lineOfSight/losCalculator.js","LoS computation (pure JS)"),
        @("src/services/","API clients, one file per service"),
        @("src/hooks/useDraggable.js","Panel drag hook"),
        @("server/index.js","Express proxy server")
    )

    Add-Heading "Layer Module Pattern" 2
    Add-Paragraph "Every map layer follows the same pattern with four functions:"
    Add-Bullet "addXxxLayers(map) — adds sources and layers to the Mapbox map"
    Add-Bullet "removeXxxLayers(map) — removes all layers and sources"
    Add-Bullet "updateXxxData(map, data) — pushes new GeoJSON data into the source"
    Add-Bullet "updateXxxVisibility(map, enabled) — toggles layer visibility"
    End-List

    Add-Heading "State Management" 2
    Add-Paragraph "All application state lives in App.jsx as React hooks (useState). Data is passed down to components as props. Map layers update through useEffect hooks that react to data changes."
    Add-PageBreak

    # ── 7. BACKEND ──────────────────────────────────────────────
    Add-Heading "7. Backend Server" 1
    Add-Paragraph "A lightweight Express proxy server on port 5174. Its purpose is to bypass browser CORS restrictions and hide API keys from the client."

    Add-Heading "API Routes" 2
    Add-Table @("Route","Method","Function") @(
        @("/api/health","GET","Server health check"),
        @("/api/weather","GET","Open-Meteo — current + 48h hourly forecast"),
        @("/api/osm","POST","Overpass API — buildings, roads, nature, etc."),
        @("/api/analyze","POST","Confidential Mind — AI terrain analysis")
    )

    Add-Heading "Environment Variables" 2
    Add-Table @("Variable","Required","Description") @(
        @("CONFIDENTIAL_MIND_BASE_URL","Yes (AI)","AI service endpoint URL"),
        @("CONFIDENTIAL_MIND_API_KEY","Yes (AI)","API key"),
        @("CONFIDENTIAL_MIND_MODEL","No","Model name (default: gemma-3-27b-it)"),
        @("PORT","No","Server port (default: 5174)")
    )

    # ── SAVE ────────────────────────────────────────────────────
    Write-Host "Saving to $outPath ..."
    $doc.SaveAs([ref] $outPath, [ref] $wdFormatDocumentDefault)
    $doc.Close()
    Write-Host "Done."
}
finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
