/* Regions, countries and profiles. Figures are approximate; verify before relying on them. */
var MIN = -3500, MAX = 2030;
var REG = [
  { id: 'eu', name: 'Europe', short: 'Europe' },
  { id: 'me', name: 'Middle East & North Africa', short: 'Mid East & N Africa' },
  { id: 'af', name: 'Sub-Saharan Africa', short: 'Africa' },
  { id: 'sa', name: 'South Asia', short: 'South Asia' },
  { id: 'ca', name: 'Central Asia & Caucasus', short: 'Central Asia' },
  { id: 'ea', name: 'East Asia', short: 'East Asia' },
  { id: 'se', name: 'Southeast Asia & Oceania', short: 'SE Asia & Oceania' },
  { id: 'am', name: 'The Americas', short: 'Americas' }
];

/* name|ISO2|ISO3|capital|lat|lon|languages|religions */
var PROF_RAW = {
eu: [
"Albania|AL|ALB|Tirana|41.3|19.8|Albanian|Islam (~55%), Christianity (~30%), many non-religious",
"Austria|AT|AUT|Vienna|48.2|16.4|German|Catholic (~55%), no religion (~20%), Islam (~8%)",
"Belarus|BY|BLR|Minsk|53.9|27.6|Belarusian, Russian|Eastern Orthodox (~70%), no religion (~20%)",
"Belgium|BE|BEL|Brussels|50.8|4.4|Dutch, French, German|Catholic (~50%), no religion (~30%), Islam (~6%)",
"Bosnia & Herzegovina|BA|BIH|Sarajevo|43.9|18.4|Bosnian, Serbian, Croatian|Islam (~50%), Orthodox (~31%), Catholic (~15%)",
"Bulgaria|BG|BGR|Sofia|42.7|23.3|Bulgarian|Eastern Orthodox (~60%), Islam (~10%)",
"Croatia|HR|HRV|Zagreb|45.8|16.0|Croatian|Catholic (~80%), Orthodox (~4%)",
"Cyprus|CY|CYP|Nicosia|35.2|33.4|Greek, Turkish|Orthodox (south), Sunni Islam (north)",
"Czechia|CZ|CZE|Prague|50.1|14.4|Czech|Majority non-religious; Catholic minority",
"Denmark|DK|DNK|Copenhagen|55.7|12.6|Danish|Lutheran (~70% nominal), many non-religious",
"Estonia|EE|EST|Tallinn|59.4|24.7|Estonian, Russian|Majority non-religious; Lutheran and Orthodox minorities",
"Finland|FI|FIN|Helsinki|60.2|24.9|Finnish, Swedish|Lutheran (~65% nominal), many non-religious",
"France|FR|FRA|Paris|48.9|2.4|French|Catholic (~50%), no religion (~30%+), Islam (~8%)",
"Germany|DE|DEU|Berlin|52.5|13.4|German|Christian (~50%, split Catholic/Protestant), no religion (~40%), Islam (~6%)",
"Greece|GR|GRC|Athens|38.0|23.7|Greek|Greek Orthodox (~90%)",
"Hungary|HU|HUN|Budapest|47.5|19.0|Hungarian|Catholic (~40%), Calvinist (~10%), many non-religious",
"Iceland|IS|ISL|Reykjavik|64.1|-21.9|Icelandic|Lutheran (~60%), many non-religious",
"Ireland|IE|IRL|Dublin|53.3|-6.3|English, Irish|Catholic (~70%), growing non-religious share",
"Italy|IT|ITA|Rome|41.9|12.5|Italian|Catholic (~70-80% nominal), growing non-religious share",
"Latvia|LV|LVA|Riga|56.9|24.1|Latvian, Russian|Lutheran, Catholic and Orthodox minorities; many non-religious",
"Lithuania|LT|LTU|Vilnius|54.7|25.3|Lithuanian|Catholic (~75%)",
"Malta|MT|MLT|Valletta|35.9|14.5|Maltese, English|Catholic (~80%), declining; growing non-religious share",
"Moldova|MD|MDA|Chisinau|47.0|28.9|Romanian (Moldovan), Russian|Eastern Orthodox (~95%)",
"Montenegro|ME|MNE|Podgorica|42.4|19.3|Montenegrin, Serbian|Orthodox (~70%), Islam (~19%)",
"Netherlands|NL|NLD|Amsterdam|52.4|4.9|Dutch|No religion (~50%), Catholic (~20%), Protestant (~14%), Islam (~5%)",
"North Macedonia|MK|MKD|Skopje|42.0|21.4|Macedonian, Albanian|Orthodox (~65%), Islam (~33%)",
"Norway|NO|NOR|Oslo|59.9|10.7|Norwegian|Lutheran (~65% nominal), many non-religious",
"Poland|PL|POL|Warsaw|52.2|21.0|Polish|Catholic (~85%)",
"Portugal|PT|PRT|Lisbon|38.7|-9.1|Portuguese|Catholic (~80% nominal)",
"Romania|RO|ROU|Bucharest|44.4|26.1|Romanian|Orthodox (~85%)",
"Russia|RU|RUS|Moscow|55.8|37.6|Russian (plus many regional languages)|Russian Orthodox (~70% nominal), Islam (~10%)",
"Serbia|RS|SRB|Belgrade|44.8|20.5|Serbian|Serbian Orthodox (~85%)",
"Slovakia|SK|SVK|Bratislava|48.1|17.1|Slovak|Catholic (~60%), many non-religious",
"Slovenia|SI|SVN|Ljubljana|46.1|14.5|Slovene|Catholic (~55%), many non-religious",
"Spain|ES|ESP|Madrid|40.4|-3.7|Spanish (Castilian), Catalan, Galician, Basque|Catholic (~55-60%), no religion (~35%)",
"Sweden|SE|SWE|Stockholm|59.3|18.1|Swedish|Lutheran (~55% nominal), majority non-practising",
"Switzerland|CH|CHE|Bern|46.9|7.4|German, French, Italian, Romansh|Christian (~60%, split Catholic/Protestant), no religion (~30%)",
"Ukraine|UA|UKR|Kyiv|50.5|30.5|Ukrainian, Russian|Orthodox (~70%), Greek Catholic (~8%)",
"United Kingdom|GB|GBR|London|51.5|-0.1|English (also Welsh, Scots Gaelic)|Christian (~46%), no religion (~37%), Islam (~6%)"
],
me: [
"Algeria|DZ|DZA|Algiers|36.8|3.1|Arabic, Tamazight (Berber), French|Sunni Islam (~98%)",
"Egypt|EG|EGY|Cairo|30.0|31.2|Arabic|Sunni Islam (~90%), Coptic Christian (~10%)",
"Iran|IR|IRN|Tehran|35.7|51.4|Persian (Farsi), Azeri, Kurdish|Shia Islam (~90%), Sunni (~8%)",
"Iraq|IQ|IRQ|Baghdad|33.3|44.4|Arabic, Kurdish|Shia Islam (~60%), Sunni (~35-40%)",
"Israel|IL|ISR|Jerusalem (disputed; Tel Aviv hosts most embassies)|31.8|35.2|Hebrew, Arabic|Judaism (~74%), Islam (~18%), Christian (~2%), Druze (~2%)",
"Jordan|JO|JOR|Amman|31.9|35.9|Arabic|Sunni Islam (~95%), Christian (~2%)",
"Kuwait|KW|KWT|Kuwait City|29.4|47.98|Arabic|Islam (~75%, mostly Sunni with a Shia minority)",
"Lebanon|LB|LBN|Beirut|33.9|35.5|Arabic, French|Islam (~67%, Shia and Sunni), Christian (~33%, mostly Maronite)",
"Libya|LY|LBY|Tripoli|32.9|13.2|Arabic|Sunni Islam (~97%)",
"Morocco|MA|MAR|Rabat|34.0|-6.8|Arabic, Tamazight (Berber), French|Sunni Islam (~99%)",
"Oman|OM|OMN|Muscat|23.6|58.4|Arabic|Islam (Ibadi majority, Sunni minority)",
"Palestine|PS|PSE|Ramallah (administrative); East Jerusalem claimed|31.9|35.2|Arabic|Sunni Islam (~85-90%), Christian minority",
"Qatar|QA|QAT|Doha|25.3|51.5|Arabic|Islam (~65%, mostly Sunni); large migrant population of other faiths",
"Saudi Arabia|SA|SAU|Riyadh|24.7|46.7|Arabic|Islam (Sunni majority, Shia ~10-15%)",
"Syria|SY|SYR|Damascus|33.5|36.3|Arabic, Kurdish|Sunni Islam (~70%), Alawite, Christian, Druze minorities",
"Tunisia|TN|TUN|Tunis|36.8|10.2|Arabic, French|Sunni Islam (~99%)",
"Turkey|TR|TUR|Ankara|39.9|32.9|Turkish, Kurdish|Islam (~99% nominal, mostly Sunni with a large Alevi minority)",
"United Arab Emirates|AE|ARE|Abu Dhabi|24.5|54.4|Arabic, English|Islam (~76%), large expatriate Hindu, Christian and other communities",
"Yemen|YE|YEM|Sana'a (Aden is the rival seat)|15.4|44.2|Arabic|Islam (Sunni ~65%, Zaydi Shia ~35%)"
],
af: [
"Angola|AO|AGO|Luanda|-8.8|13.2|Portuguese, Umbundu, Kimbundu|Catholic (~40%), Protestant (~40%)",
"Cameroon|CM|CMR|Yaounde|3.9|11.5|French, English (plus ~250 local languages)|Christian (~70%), Islam (~20%)",
"DR Congo|CD|COD|Kinshasa|-4.3|15.3|French, Lingala, Swahili, Kikongo, Tshiluba|Christian (~95%, Catholic and Protestant)",
"Ethiopia|ET|ETH|Addis Ababa|9.0|38.7|Amharic, Oromo, Tigrinya|Orthodox Christian (~40%), Islam (~35%), Protestant (~20%)",
"Ghana|GH|GHA|Accra|5.6|-0.2|English, Akan (Twi), Ewe, Ga|Christian (~70%), Islam (~20%)",
"Ivory Coast|CI|CIV|Yamoussoukro (Abidjan is the economic capital)|6.8|-5.3|French, Dioula|Islam (~40%), Christian (~40%)",
"Kenya|KE|KEN|Nairobi|-1.3|36.8|Swahili, English|Christian (~85%), Islam (~11%)",
"Madagascar|MG|MDG|Antananarivo|-18.9|47.5|Malagasy, French|Christian (~50%), traditional beliefs (~40%)",
"Mali|ML|MLI|Bamako|12.6|-8.0|French, Bambara|Islam (~95%)",
"Mozambique|MZ|MOZ|Maputo|-25.97|32.6|Portuguese, Makhuwa|Christian (~55%), Islam (~19%)",
"Namibia|NA|NAM|Windhoek|-22.6|17.1|English, Afrikaans, Oshiwambo|Christian (~90%, mostly Lutheran)",
"Nigeria|NG|NGA|Abuja|9.1|7.5|English, Hausa, Yoruba, Igbo|Islam (~50%, mainly north), Christian (~48%, mainly south)",
"Rwanda|RW|RWA|Kigali|-1.95|30.06|Kinyarwanda, French, English|Christian (~93%), Islam (~2%)",
"Senegal|SN|SEN|Dakar|14.7|-17.5|French, Wolof|Islam (~95%, Sufi brotherhoods strong)",
"Somalia|SO|SOM|Mogadishu|2.0|45.3|Somali, Arabic|Sunni Islam (~99%)",
"South Africa|ZA|ZAF|Pretoria (executive), Cape Town (legislative), Bloemfontein (judicial)|-25.7|28.2|11 official languages incl. Zulu, Xhosa, Afrikaans, English|Christian (~80%), traditional and no religion minorities",
"South Sudan|SS|SSD|Juba|4.85|31.6|English, Arabic, Dinka, Nuer|Christian (~60%), traditional beliefs, Islam minority",
"Sudan|SD|SDN|Khartoum|15.5|32.5|Arabic, English|Sunni Islam (~90%)",
"Tanzania|TZ|TZA|Dodoma (Dar es Salaam is the largest city)|-6.2|35.7|Swahili, English|Christian (~60%), Islam (~35%)",
"Uganda|UG|UGA|Kampala|0.35|32.6|English, Swahili, Luganda|Christian (~85%), Islam (~14%)",
"Zambia|ZM|ZMB|Lusaka|-15.4|28.3|English, Bemba, Nyanja|Christian (~95%)",
"Zimbabwe|ZW|ZWE|Harare|-17.8|31.05|English, Shona, Ndebele|Christian (~85%), traditional beliefs minority"
],
sa: [
"Afghanistan|AF|AFG|Kabul|34.5|69.2|Pashto, Dari|Sunni Islam (~85-90%), Shia (~10-15%)",
"Bangladesh|BD|BGD|Dhaka|23.8|90.4|Bengali|Islam (~91%), Hinduism (~8%)",
"Bhutan|BT|BTN|Thimphu|27.5|89.6|Dzongkha|Vajrayana Buddhism (~75%), Hinduism (~22%)",
"India|IN|IND|New Delhi|28.6|77.2|Hindi, English, plus 20+ other scheduled languages|Hinduism (~80%), Islam (~14%), Christian (~2%), Sikh (~2%)",
"Maldives|MV|MDV|Male|4.2|73.5|Dhivehi|Sunni Islam (state religion)",
"Nepal|NP|NPL|Kathmandu|27.7|85.3|Nepali|Hinduism (~81%), Buddhism (~9%), Islam (~5%)",
"Pakistan|PK|PAK|Islamabad|33.7|73.1|Urdu, English, Punjabi, Sindhi, Pashto|Sunni Islam (~85%), Shia (~10-15%)",
"Sri Lanka|LK|LKA|Sri Jayawardenepura Kotte (Colombo is the commercial capital)|6.9|79.9|Sinhala, Tamil|Buddhism (~70%), Hinduism (~13%), Islam (~10%), Christian (~7%)"
],
ca: [
"Armenia|AM|ARM|Yerevan|40.2|44.5|Armenian|Armenian Apostolic Christian (~90%)",
"Azerbaijan|AZ|AZE|Baku|40.4|49.9|Azerbaijani|Islam (~97%, Shia majority)",
"Georgia|GE|GEO|Tbilisi|41.7|44.8|Georgian|Georgian Orthodox (~83%), Islam (~10%)",
"Kazakhstan|KZ|KAZ|Astana|51.2|71.4|Kazakh, Russian|Islam (~70%), Christian (~25%)",
"Kyrgyzstan|KG|KGZ|Bishkek|42.9|74.6|Kyrgyz, Russian|Sunni Islam (~90%)",
"Mongolia|MN|MNG|Ulaanbaatar|47.9|106.9|Mongolian|Tibetan Buddhism (~50%), many non-religious, shamanist traditions",
"Tajikistan|TJ|TJK|Dushanbe|38.6|68.8|Tajik (Persian), Russian|Sunni Islam (~95%)",
"Turkmenistan|TM|TKM|Ashgabat|37.96|58.3|Turkmen, Russian|Sunni Islam (~90%)",
"Uzbekistan|UZ|UZB|Tashkent|41.3|69.3|Uzbek, Russian|Sunni Islam (~88%)"
],
ea: [
"China|CN|CHN|Beijing|39.9|116.4|Mandarin (plus Cantonese, Wu and many others)|Officially atheist; folk religion, Buddhism, Taoism, Christianity and Islam minorities",
"Japan|JP|JPN|Tokyo|35.7|139.7|Japanese|Shinto and Buddhism (often combined); most describe themselves as non-religious",
"Korea (pre-1945)||KOR|Seoul (Hanseong)|37.6|127.0|Korean|Confucian state ideology with Buddhism and shamanism (Joseon era); pseudo-entry for events before partition",
"North Korea|KP|PRK|Pyongyang|39.0|125.8|Korean|Officially atheist; state ideology Juche",
"South Korea|KR|KOR|Seoul|37.6|127.0|Korean|No religion (~55%), Christian (~28%), Buddhism (~15%)",
"Taiwan|TW|TWN|Taipei|25.0|121.6|Mandarin, Taiwanese Hokkien, Hakka|Folk religion, Buddhism and Taoism; Christian minority"
],
se: [
"Australia|AU|AUS|Canberra|-35.3|149.1|English (plus 100+ Indigenous languages)|No religion (~39%), Christian (~44%), Islam, Hinduism and Buddhism minorities",
"Brunei|BN|BRN|Bandar Seri Begawan|4.9|114.9|Malay|Sunni Islam (~80%)",
"Cambodia|KH|KHM|Phnom Penh|11.6|104.9|Khmer|Theravada Buddhism (~97%)",
"Fiji|FJ|FJI|Suva|-18.1|178.4|English, Fijian, Fiji Hindi|Christian (~65%), Hinduism (~28%), Islam (~6%)",
"Indonesia|ID|IDN|Jakarta|-6.2|106.8|Indonesian (plus 700+ regional languages)|Islam (~87%, the world's largest Muslim population), Christian (~10%), Hindu (Bali)",
"Laos|LA|LAO|Vientiane|17.97|102.6|Lao|Theravada Buddhism (~65%), traditional beliefs",
"Malaysia|MY|MYS|Kuala Lumpur (Putrajaya is the administrative centre)|3.1|101.7|Malay, English, Chinese dialects, Tamil|Islam (~64%), Buddhism (~19%), Christian (~9%), Hindu (~6%)",
"Myanmar|MM|MMR|Naypyidaw (Yangon is the largest city)|19.76|96.1|Burmese (plus Shan, Karen, Kachin and many others)|Theravada Buddhism (~88%), Christian (~6%), Islam (~4%)",
"New Zealand|NZ|NZL|Wellington|-41.3|174.8|English, Te Reo Maori, NZ Sign Language|No religion (~48%), Christian (~37%)",
"Papua New Guinea|PG|PNG|Port Moresby|-9.5|147.2|Tok Pisin, English, Hiri Motu (plus ~840 languages)|Christian (~95%)",
"Philippines|PH|PHL|Manila|14.6|121.0|Filipino (Tagalog), English|Catholic (~80%), Islam (~6%), Protestant minorities",
"Samoa|WS|WSM|Apia|-13.8|-171.8|Samoan, English|Christian (~98%)",
"Singapore|SG|SGP|Singapore|1.35|103.8|English, Mandarin, Malay, Tamil|Buddhism (~31%), Christian (~19%), Islam (~16%), no religion (~20%), Taoism and Hindu minorities",
"Solomon Islands|SB|SLB|Honiara|-9.4|160.0|English, Solomons Pijin|Christian (~95%)",
"Thailand|TH|THA|Bangkok|13.75|100.5|Thai|Theravada Buddhism (~93%), Islam (~5%)",
"Timor-Leste|TL|TLS|Dili|-8.6|125.6|Tetum, Portuguese|Catholic (~97%)",
"Tonga|TO|TON|Nuku'alofa|-21.1|-175.2|Tongan, English|Christian (~98%, mainly Free Wesleyan)",
"Vanuatu|VU|VUT|Port Vila|-17.7|168.3|Bislama, English, French (plus 100+ local languages)|Christian (~85%); kastom and cargo-cult traditions including John Frum",
"Vietnam|VN|VNM|Hanoi|21.0|105.8|Vietnamese|Most non-religious or folk religion; Buddhism (~15%), Catholic (~7%)"
],
am: [
"Argentina|AR|ARG|Buenos Aires|-34.6|-58.4|Spanish|Catholic (~60-65%), Protestant (~15%), no religion (~19%)",
"Bolivia|BO|BOL|Sucre (constitutional), La Paz (seat of government)|-19.0|-65.3|Spanish, Quechua, Aymara and 34 other official languages|Catholic (~75%), Protestant (~15%)",
"Brazil|BR|BRA|Brasilia|-15.8|-47.9|Portuguese|Catholic (~50%), Protestant/evangelical (~30%), no religion (~10%)",
"Canada|CA|CAN|Ottawa|45.4|-75.7|English, French|Christian (~53%), no religion (~35%)",
"Chile|CL|CHL|Santiago|-33.4|-70.7|Spanish|Catholic (~55%), evangelical (~15%), no religion (~25%)",
"Colombia|CO|COL|Bogota|4.7|-74.1|Spanish|Catholic (~75%), Protestant (~15%)",
"Costa Rica|CR|CRI|San Jose|9.9|-84.1|Spanish|Catholic (~50-60%), evangelical (~25%)",
"Cuba|CU|CUB|Havana|23.1|-82.4|Spanish|Mixed: Catholic roots, Santeria, Protestant minority, many non-religious",
"Ecuador|EC|ECU|Quito|-0.2|-78.5|Spanish, Quechua|Catholic (~80%), evangelical (~10%)",
"Guatemala|GT|GTM|Guatemala City|14.6|-90.5|Spanish and 20+ Mayan languages|Catholic (~45%), Protestant (~40%)",
"Haiti|HT|HTI|Port-au-Prince|18.5|-72.3|Haitian Creole, French|Christian (~85%), Vodou widely practised alongside",
"Jamaica|JM|JAM|Kingston|18.0|-76.8|English, Jamaican Patois|Protestant (~65%), Rastafari minority",
"Mexico|MX|MEX|Mexico City|19.4|-99.1|Spanish (plus ~68 Indigenous languages)|Catholic (~78%), Protestant (~11%)",
"Nicaragua|NI|NIC|Managua|12.1|-86.3|Spanish|Catholic (~50%), Protestant/evangelical (~33%)",
"Panama|PA|PAN|Panama City|9.0|-79.5|Spanish|Catholic (~65%), Protestant (~20%)",
"Paraguay|PY|PRY|Asuncion|-25.3|-57.6|Spanish, Guarani|Catholic (~85%)",
"Peru|PE|PER|Lima|-12.0|-77.0|Spanish, Quechua, Aymara|Catholic (~75%), evangelical (~15%)",
"United States|US|USA|Washington, D.C.|38.9|-77.0|English (de facto), Spanish widely spoken|Christian (~63%), no religion (~29%), other faiths minorities",
"Uruguay|UY|URY|Montevideo|-34.9|-56.2|Spanish|Catholic (~45%), no religion (~40%)",
"Venezuela|VE|VEN|Caracas|10.5|-66.9|Spanish|Catholic (~70%), Protestant (~15%)"
]
};

/* Build CO (region -> country names) and PROF (country -> profile) */
var CO = {}, PROF = {}, REGOF = {};
(function () {
  Object.keys(PROF_RAW).forEach(function (r) {
    CO[r] = [];
    PROF_RAW[r].forEach(function (line) {
      var p = line.split('|');
      PROF[p[0]] = { iso2: p[1], iso3: p[2], cap: p[3], lat: +p[4], lon: +p[5], lang: p[6], rel: p[7], region: r };
      CO[r].push(p[0]); REGOF[p[0]] = r;
    });
  });
})();
function flagOf(c) {
  var p = PROF[c];
  if (!p || !p.iso2) return '\u{1F30D}';
  return String.fromCodePoint.apply(null, p.iso2.split('').map(function (ch) { return 127397 + ch.charCodeAt(0); }));
}
