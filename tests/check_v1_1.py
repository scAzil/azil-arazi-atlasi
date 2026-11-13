"""Offline structural regression checks for the Arazi Atlası v1.1 desktop patch.

No archive files, coordinates, images or private user data are required.
Run: python tests/check_v1_1.py <extracted Electron app directory>
"""
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import sys

class Structure(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = {}
        self.actions = set()
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids[attrs["id"]] = {"tag": tag, "attrs": attrs}
        if "data-action" in attrs:
            self.actions.add(attrs["data-action"])

def test(app):
    root = Path(app)
    html = (root / "app/index.html").read_text(encoding="utf-8")
    css = (root / "app/desktop.css").read_text(encoding="utf-8")
    js = (root / "app/desktop.js").read_text(encoding="utf-8")
    main = (root / "electron/main.cjs").read_text(encoding="utf-8")
    preload = (root / "electron/preload.cjs").read_text(encoding="utf-8")
    pkg = json.loads((root / "package.json").read_text(encoding="utf-8"))
    found = Structure()
    found.feed(html)
    needed = {"mapView", "map", "mapQuickbar", "mapToolbar", "layers", "mapDetail"}
    assert needed <= set(found.ids), needed - set(found.ids)
    controls = {
        "map-return", "map-sidebar", "map-tools",
        "toggle-layers", "toggle-detail", "map-fullscreen"
    }
    assert controls <= found.actions, controls - found.actions
    for text in (
        "body.map-workspace #mapView", "body.map-workspace #map",
        "body.map-workspace #sidebar", "body.map-workspace #mapToolbar",
        "body.map-workspace #layers", "body.map-workspace #mapDetail"
    ):
        assert text in css, f"Missing map layout rule: {text}"
    for method in ("updateMapWorkspace", "toggleMapPanel", "preparePhoto", "mapUI", "openLayerStyleEditor", "exportAtlas", "importAtlas"):
        assert "function " + method in js or "async function " + method in js, method
    for action in ("'map-return'", "'map-sidebar'", "'map-tools'", "'map-fullscreen'",
                   "'toggle-layers'", "'toggle-detail'", "'storage-info'", "'layer-style'", "'archive-export'", "'archive-import'"):
        assert action in js, action
    assert "map.invalidateSize" in js
    assert "photoMax" in js and "1280" in js and "1920" in js
    assert "window-fullscreen" in main and "window-fullscreen" in preload
    assert "'storage':async" in main and "'storage'" in preload
    assert "QR" in js and "startReceiver" in js, "Phone-to-PC transfer must survive"
    assert "function loadKMZ" in js and "function drawMeasure" in js
    assert pkg["main"] == "electron/main.cjs"
    assert pkg["version"] == "1.1.1-beta.1"
    assert (root / "app/pafta.js").is_file()
    assert (root / "app/transfer.js").is_file()
    assert (root / "electron/store.cjs").is_file()
    assert (root / "electron/portable-archive.cjs").is_file()
    assert (root / "app/atlas-standard.js").is_file()
    assert (root / "app/startup-diagnostics.js").is_file()
    assert (root / "app/help-center.js").is_file()
    assert (root / "electron/help-diagnostics.cjs").is_file()
    assert (root / "electron/lan-receiver.cjs").is_file()
    assert "lan-start" in main and "lan-stop" in main
    assert "onLan" in preload and "azil-atlas://lan" in (root / "electron/lan-receiver.cjs").read_text(encoding="utf-8")
    assert "function openHelpCenter" in js
    assert "help:guide" in main and "help:notes" in main
    assert "help-diagnostics" in main and "help-diagnostics" in preload
    assert "data-action=\"help-map\"" in html
    assert "atlasHelpLayout" in css
    assert "function openLayerStyleEditor" in js
    assert "geometryStyle(f.geometry,l)" in js
    assert "Yedekten geri yükle" not in js
    assert "Harici yedekten dön" not in js
    assert "Eski AppData yedeğini al" not in js
    assert "archive-export" in main and "archive-import" in main
    assert "archive-export" in preload and "archive-import" in preload
    print("PASS: fullscreen map, panel toggles, photo presets, storage, QR, KMZ, archives, version")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: check_v1_1.py <extracted Electron app directory>")
    test(sys.argv[1])
