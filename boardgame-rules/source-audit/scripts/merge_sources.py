import json
from pathlib import Path

root = Path('/workspace/plugins/board-game-rules-source-audit')
path = root/'data/source-audit-registry.v1.0.0.json'
r = json.loads(path.read_text())

COMMON = {
    'source_verification_status': 'verified_official_public_reference',
    'rights_status': 'permission_not_granted_or_unclear',
    'indexability_status': 'blocked_pending_explicit_permission',
    'accessed_on': '2026-08-12',
}

def src(publisher, url, kind, edition, language='English', notes=''):
    return {
        'publisher': publisher,
        'official_url': url,
        'source_type': kind,
        'edition_scope': edition,
        'language': language,
        **COMMON,
        'notes': notes or 'Official publisher/developer source located during the source audit. Public access is not permission to index or redistribute full text.'
    }

S = {
 '182874': [src('Lookout Games', 'https://www.lookout-spiele.de/en/games/grandaustriahotel.html', 'official_publisher_game_page_with_downloads_and_faq', 'Retail Edition 2022 rules; English and German resources listed', 'English and German')],
 '342942': [src('Capstone Games / Feuerland Spiele', 'https://capstone-games.com/products/ark-nova', 'official_publisher_resources_page', 'Capstone English retail; rulebook, guide, glossary, and FAQ listed', notes='Official product/resources page verified.'), src('Feuerland Spiele', 'https://feuerland-spiele.de/fileadmin/game/Arche_Nova/Arche_Nova_FAQ_V2_EN_A4_low.pdf', 'official_developer_hosted_faq_pdf', 'Ark Nova FAQ v2', notes='Official English FAQ PDF. This is supplementary material, not a substitute for the base rulebook.')],
 '224517': [src('Roxley Games', 'https://roxley.com/products/brass-birmingham', 'official_publisher_game_page_with_downloadable_rulebooks', 'Retail edition; English, Spanish, Italian, French, and German downloads listed', 'English, Spanish, Italian, French, and German')],
 '400602': [src('Deep Print Games', 'https://deep-print-games.com/en/spiele/civolution/', 'official_publisher_game_page_with_rulebook_glossary_and_errata', 'English Rulebook v1.0; German and French also listed', 'English, German, and French')],
 '418059': [src('Czech Games Edition', 'https://www.czechgames.com/games/seti-search-for-extraterrestrial-intelligence#downloads', 'official_publisher_game_and_downloads_page', 'Base game; official downloads section; exact language scope to pin', notes='An indexed rules PDF URL redirected to the official SETI page.')],
 '391137': [src('Kinson Key Games', 'https://www.kinsonkeygames.com/galactic-cruise-achievements-single-page-rulebook', 'official_supplementary_achievement_pdf_page', 'Base-game campaign achievement materials; not the base rulebook', notes='Official source, but not a base rules document.')],
 '217398': [src('Stronghold Games', 'https://strongholdgames.com/our-games/path-of-light-and-shadow/', 'official_publisher_game_page', 'English; edition not specified', notes='Official game page located; rules PDF not confirmed.')],
 '182028': [src('Czech Games Edition', 'https://czechgames.com/files/rules/through-the-ages-new-story-rules-en.pdf', 'official_publisher_rules_pdf', 'New Story of Civilization / revised 2015 edition', notes='Direct official English rules PDF.'), src('Czech Games Edition', 'https://czechgames.com/en/through-the-ages/downloads', 'official_publisher_downloads_page', 'New Story of Civilization; English downloads', notes='Official downloads page.')],
 '246784': [src('Osprey Games', 'https://ospreypublishing.com/ca/discover/gaming-resources/learn-to-play-cryptid/', 'official_publisher_how_to_play_resource', 'Base game; edition not specified', notes='Official rules/how-to-play resource page.'), src('Osprey Games', 'https://www.ospreypublishing.com/uk/osprey-blog/2018/cryptid-go-head-to-head-with-these-2-player-rules/', 'official_publisher_rules_article', 'Two-player rules variant', notes='Supplementary two-player rules, not the complete base rulebook.')],
 '167791': [src('FryxGames', 'https://fryxgames.se/product/terraforming-mars/', 'official_publisher_product_page', 'Base game; English product page', notes='The discovered TMDG_RULES_ENGi.pdf was excluded because it appears to be Terraforming Mars: The Dice Game, not the BGG base game. No official base-game rules PDF was confirmed in this pass.')],
 '329839': [src('Repos Production', 'https://rprod.com/en/press/so-clover', 'official_publisher_press_and_game_page', 'English; edition not specified', notes='Official page located; rules PDF not confirmed.')],
 '256916': [src('Rio Grande Games', 'https://www.riograndegames.com/wp-content/uploads/2018/11/Concordia-Venus-Rules-V11.pdf', 'official_publisher_hosted_rules_pdf', 'Concordia Venus, English Rules V1.1')],
 '159675': [src('Feuerland Spiele', 'https://www.feuerland-spiele.de/fileadmin/game/Arler_Erde/Regelbuch_englisch.pdf', 'official_publisher_or_developer_hosted_rules_pdf', 'Fields of Arle; English; edition not specified')],
 '310873': [src('Quined Games', 'https://www.quined.nl/wp-content/uploads/2022/05/Carnegie-rules-EN-WEB.pdf', 'official_publisher_hosted_rules_pdf', 'Carnegie; English; 2022 web PDF'), src('Quined Games', 'https://quined.nl/featured_item/carnegie', 'official_publisher_game_page', 'Carnegie; edition not specified')],
 '220': [src('Osprey Games', 'https://ospreypublishing.com/us/high-society-9781472827777', 'official_publisher_product_page', 'English; edition not specified', notes='Official product page located; no rules PDF found.')],
 '397385': [src('Board&Dice / dlp games', 'https://boardanddice.com/our-games/pirates-of-maracaibo/', 'official_publisher_game_page_candidate', 'Edition not specified', notes='No official rules PDF located; this record should remain a candidate until the URL is independently rechecked.')],
 '351913': [src('Board&Dice', 'https://boardanddice.com/our-games/tiletum/', 'official_publisher_game_page', 'Edition not specified', notes='Official game page located; no rules PDF confirmed.'), src('Board&Dice', 'https://boardanddice.com/download/', 'official_publisher_downloads_page', 'Downloads hub; Tiletum document not identified', notes='Official downloads page located; exact Tiletum rules file not identified.')],
 '174430': [src('Cephalofair Games', 'https://cephalofair.com/pages/gloomhaven', 'official_publisher_game_rules_repository_and_errata_page', '2025 first-printing information; exact direct rulebook PDF edition not pinned', notes='Official support/errata repository; direct edition-specific rulebook PDF still needs confirmation.')],
 '66589': [src('PD-Verlag / Rio Grande Games', 'https://pd-verlag.de/Navegador/en', 'official_publisher_game_page', 'English publisher page; edition not determined', notes='Official game page lead; rules PDF not confirmed.')],
 '217372': [src('Ravensburger', 'https://product-files.ravensburger.cloud/manuals/665012.pdf', 'official_publisher_hosted_rules_pdf', 'English; PDF identified as 27456 / manual 665012; likely newer edition')],
 '346501': [src('Schmidt Spiele', 'https://schmidtspiele.de/files/Retail/300dpi_JPG/88399_Mille%20Fiori_UK.pdf', 'official_publisher_hosted_rules_pdf', 'Mille Fiori product 88399; English/UK')],
 '760': [src('GMT Games', 'https://www.gmtgames.com/nnbl/battleline_main.html', 'official_publisher_game_page_with_rules_resources', 'GMT publication, 2000; printing not specified', notes='Official page with rules/resource section; direct PDF identity not independently pinned.')],
 '208895': [src('Bezier Games', 'https://beziergames.com/collections/board-games/products/new-york-slice', 'official_publisher_product_page', 'Edition not determined', notes='Official product page; rules PDF not confirmed.')],
 '156129': [src('Grey Fox Games', 'https://greyfoxgames.com/collections/all/products/deception-murder-in-hong-kong', 'official_publisher_product_page', 'Edition not determined', notes='Official product page; rules PDF not confirmed.')],
 '322289': [src('Thundergryph Games', 'https://thundergryph.com/rulebooks/', 'official_publisher_rulebooks_index', "Darwin's Journey base game, special editions, expansions, and add-ons; individual language/PDF details to pin", notes='Official rulebooks index; exact base-game PDF should be pinned during ingestion.')],
 '276182': [src('Alderac Entertainment Group (AEG)', 'https://www.alderac.com/dead-reckoning-rules/', 'official_publisher_rules_page', 'Base and expansion rules; English, French, and German listed', 'English, French, and German')],
 '62219': [src('GMT Games', 'https://www.gmtgames.com/p-909-dominant-species-6th-printing.aspx', 'official_publisher_product_page_with_living_rules_pdf', 'Dominant Species 6th Printing; English final rulebook; errata corrected')],
 '258779': [src("Adam's Apple Games", 'https://adamsapplegames.com/planetunknown/', 'official_publisher_game_page', 'Edition not determined', notes='Official game page; rulebook PDF not confirmed.')],
 '342810': [src('Queen Games', 'https://rules.queen-games.com/marrakesh_en.pdf', 'official_publisher_hosted_rules_pdf', 'Marrakesh standard/classic edition; English; 2022 file')],
 '3': [src('Hans im Glück', 'https://hans-im-glueck.de/en/games/samurai-en.html', 'official_publisher_game_page_candidate', 'English page lead; edition not determined', notes='URL returned 404 during verification and rules PDF was not confirmed. Keep as unverified lead, not a verified source.')],
 '163412': [src('Lookout Games', 'https://www.lookout-spiele.de/en/games/patchwork.html', 'official_publisher_game_page_with_downloads_and_faq', 'Original 2014 edition context; English page; German rules download explicitly listed', notes='Official page verified; exact English PDF identity not pinned.')],
 '314040': [src('Z-Man Games', 'https://www.zmangames.com/game/pandemic-legacy-season-0/', 'official_publisher_product_page_with_rulebook_link', 'Pandemic Legacy: Season 0; English base edition')],
}

# Sources that were explicitly searched but not located. Preserve the negative result as audit metadata.
NOT_FOUND = {
 '12': ('alea / Rio Grande Games', 'No official rules page or PDF located after this pass; third-party and BGG files excluded.'),
 '84876': ('Alea / Ravensburger', 'No official rules page or PDF located after this pass.'),
 '34219': ("Dr. Finn's Games / Steve Finn", 'No official rules page or PDF located after this pass.'),
 '177736': ('Feuerland Spiele', 'No official base-game rules page or PDF located after this pass.'),
 '251247': ('Cranio Creations', 'Official product pages were found, but no official rules page or PDF was confirmed.'),
 '245934': ('Alea / Ravensburger', 'No official rules page or PDF located after this pass.'),
 '332772': ('Aporta Games', 'Official Aporta game site located, but no official Revive rules page or PDF confirmed.'),
 '276025': ('dlp games / Game Brewer', 'No official rules page or PDF located after this pass.'),
 '396790': ('Board&Dice / Giant Roc', 'Official publisher game page located, but no official rules page or PDF confirmed.'),
 '203993': ('Cranio Creations', 'No official rules page or PDF located after this pass.'),
 '102680': ('HUCH! / Ammonit Spiele', 'No official rules page or PDF located after this pass.'),
 '47': ('Z-Man Games', 'No current official rules page or PDF confirmed; indexed product URL returned 404.'),
 '262215': ('Lookout Games', 'No official publisher/developer rules page or PDF located after the pass.'),
 '220308': ('Feuerland Spiele', 'No official rules PDF located after this pass.'),
 '143693': ('Lookout Games', 'No official rules source located after this pass.'),
 '281442': ('Cranio Creations', 'No official rules source located after this pass.'),
 '173346': ('Repos Production', 'No official Repos rules page or PDF located after this pass.'),
 '318560': ('HUCH! / dlp games', 'No official rules page or PDF located after this pass.'),
}

for g in r['games']:
    key = str(g['bgg_id'])
    if key in S:
        g['official_sources'] = S[key]
        has_rules = any('rules' in x['source_type'] or 'rulebook' in x['source_type'] or 'downloads' in x['source_type'] or 'how_to_play' in x['source_type'] for x in S[key])
        g['source_audit_status'] = 'official_rules_material_located' if has_rules else 'official_source_located_rules_not_confirmed'
        g['fallback_tier'] = 'official_public_reference_pending_rights_review'
    elif key in NOT_FOUND:
        publisher, note = NOT_FOUND[key]
        g['official_sources'] = []
        g['source_audit_status'] = 'no_official_rules_source_located_after_pass'
        g['source_search_notes'] = {'publisher_or_developer': publisher, 'result': note, 'third_party_sources_excluded': True}
        g['fallback_tier'] = 'source_not_located'
    else:
        raise RuntimeError(f'No audit disposition for {g["rank"]} {g["title"]} ({key})')

r['registry_version'] = '1.1.0'
r['source_policy']['source_status_vocabulary'] = [
    'official_rules_material_located',
    'official_source_located_rules_not_confirmed',
    'no_official_rules_source_located_after_pass',
    'official_source_candidate',
    'third_party_or_user_source_only'
]
r['source_policy']['audit_pass_note'] = 'This pass searched official publisher/developer domains and excluded BGG-hosted files, aggregators, and third-party rule hosts from official-source counts.'
r['summary'] = {
    'games_in_scope': 50,
    'rank_membership_verified': 50,
    'games_with_official_rules_or_download_material_located': sum(g['source_audit_status']=='official_rules_material_located' for g in r['games']),
    'games_with_official_source_but_rules_not_confirmed': sum(g['source_audit_status']=='official_source_located_rules_not_confirmed' for g in r['games']),
    'games_with_no_official_rules_source_located_after_pass': sum(g['source_audit_status']=='no_official_rules_source_located_after_pass' for g in r['games']),
    'source_records': sum(len(g['official_sources']) for g in r['games']),
    'games_with_explicit_full_text_indexing_permission': 0,
    'note': 'This is a source-discovery registry, not a rulebook corpus. It intentionally makes no full-text redistribution claim.'
}

assert len(r['games']) == 50
assert [g['rank'] for g in r['games']] == list(range(1, 51))
assert len({g['bgg_id'] for g in r['games']}) == 50
assert sum(len(g['official_sources']) for g in r['games']) == r['summary']['source_records']
path.write_text(json.dumps(r, indent=2, ensure_ascii=False)+'\n')
print(json.dumps(r['summary'], indent=2))
