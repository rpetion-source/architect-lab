"""Test de fumée end-to-end du parcours guidé (Chromium, ordinateur et mobile). Lancer depuis la racine après le build."""
import asyncio, os
from playwright.async_api import async_playwright
URL = "file://" + os.path.abspath("dist/index.html")
CASES = [("hr-sharepoint", "B", "Fuite !"), ("fabric-rls", "B", "Fuite !"), ("foundry-mcp", "G", "Bloqué : la sécurité fonctionne"),
         ("finance-d365", "D", "Fuite !"), ("sales-dataverse", "F", "Bloqué : la sécurité fonctionne"), ("docs-sharepoint", "C", "Bloqué : la sécurité fonctionne"),
         ("invoices", "B", "Bloqué : la sécurité fonctionne"), ("external-model", "C", "Bloqué : la sécurité fonctionne")]

async def main():
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, h), name in [((1440, 900), "desktop"), ((390, 844), "mobile")]:
            pg = await b.new_page(viewport={"width": w, "height": h}, reduced_motion="reduce")
            pg.on("pageerror", lambda e: errors.append(str(e)))
            await pg.route("**/fonts.*/**", lambda r: r.abort())
            await pg.goto(URL)
            await pg.click("[data-open=hr-sharepoint]")
            await pg.wait_for_selector("#canvasView:not([hidden])")
            # 1. La demande : un seul bouton
            assert await pg.is_visible("#goBtn"), "bouton Lancer absent"
            # 2. Le trajet : lancer puis aller au verdict
            await pg.click("#goBtn"); await pg.wait_for_timeout(700)
            assert await pg.is_visible("#narr .ctrl"), "narration sans contrôles"
            await pg.click("#skipBtn")
            v0 = (await pg.text_content(".verdict-card .vhead b")).strip()
            print(name, "départ RH ->", v0)
            # 4. Et si… : chaque scénario
            for sid, preset, expect in CASES:
                await pg.goto(URL + "#" + sid); await pg.wait_for_selector("#canvasView:not([hidden])")
                await pg.click("#goBtn"); await pg.click("#skipBtn")
                await pg.click(f".whatif[data-preset={preset}]")
                await pg.click("#skipBtn")
                v = (await pg.text_content(".verdict-card .vhead b")).strip()
                cmp = await pg.is_visible(".compare")
                print(name, sid, preset, "->", v, "| comparaison:", cmp)
                assert v == expect, (sid, v); assert cmp
            # Réglages avancés : changement instantané
            await pg.click("#hDrawer"); await pg.select_option("#p-model", "claude-anthropic")
            v2 = (await pg.text_content(".verdict-card .vhead b")).strip()
            print(name, "réglage avancé (Claude chez Anthropic) ->", v2); assert v2 == "Bloqué : la sécurité fonctionne"
            await pg.click("#drawerClose")
            await pg.goto(URL + "#hr-sharepoint"); await pg.wait_for_selector("#canvasView:not([hidden])")
            await pg.click("#goBtn"); await pg.wait_for_timeout(2600)
            await pg.screenshot(path=f"/tmp/flow-{name}.png")
        await b.close()
    real = [e for e in errors if "ERR_FAILED" not in e]
    print("ERREURS:", real)
    assert not real
asyncio.run(main())
