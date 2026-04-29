// One-shot script: add etymology/origin "kanjiStory" to kana-only entries that lack one.
// Run from repo root:  node scripts/add_stories.mjs
import { readFileSync, writeFileSync } from "node:fs";

const STORIES = {
  "～ことから": "こと(matter/fact) + から(from) = literally 'starting from the fact that ~' → reason inferred from situation.",
  "～のみならず": "のみ(only) + ならず(not staying as) = 'doesn't stop at only A, also B'. Classical/written register.",
  "～といった": "と(quote) + 言った(said) = 'said as ~' → introducing examples from a category.",
  "～にしたがって": "従う(to follow) + て-form → 'following along the change' → as A shifts, B follows in sync.",
  "～つつある": "つつ(while doing) + ある(exist) = 'in the state of doing' → mid-transition, ongoing change.",
  "～につきまして": "Super-polite form of について. 就(reach/concerning) + ます-style → keigo register 'regarding'.",
  "～のなんのって": "の何の(this and that) + って(quote) → 'I can't even describe how ~' — over-the-top emphasis.",
  "～たて": "From 立て(stood up) → 'just stood up from being made' → freshly done, like 'fresh-baked'.",
  "～ったら": "Casual contraction of といったら ('speaking of'). Used to vent recurring annoyance about someone.",
  "～ようになっている": "様(state) + になっている(has become) → 'has come to be the way ~' = designed/set up that way.",
  "～わけだ": "訳(reason/meaning) + だ(is) → 'so THAT'S the reason' — the click moment when things make sense.",
  "～ようでは / ～ようじゃ": "様(state/condition) + では(if it's like this) → 'if things are this way, that's bad'. Negative judgment.",
  "～ぶる": "From 振る(behave/act). Attached to a noun = 'put on the air of ~' → pretense, always slightly negative.",
  "～ことだ": "こと(the matter) + だ(is) → 'the matter is that you should ~' = direct advice/admonition.",
  "～という＋N": "と(quote) + 言う(call) + N → 'every X you can call X' — every single one without exception.",
  "～ところだった": "所(place/point) → 'I was right at the point of ~ing' → close call, almost happened but didn't.",
  "～くらいなら": "位(extent) + なら(if it's at that level) → 'if it'd come to A, I'd rather B' — preference between bad options.",
  "～まし（だ）": "From classical 増し(more/increase) → 'more preferable than the worse one'. Picking the lesser evil.",
  "～ものがある": "物(thing) + がある(exists) → 'there is a [quality] to it' — speaker's emotional reaction.",
  "～まい": "Classical negative volitional from まじ → 'shall not / surely not'. Old-Japanese flavor in modern formal writing.",
  "～につけ": "付け(attach to) → 'every time something attaches to me, this feeling rises' → recurring emotional reaction.",
  "～わりに（は）": "割り(proportion/ratio) → 'compared to the proportion expected, the result is unexpected'.",
  "～うちに": "内(inside) → 'while still inside the time-window of ~' → before the state changes, do it now.",
  "～げ": "Classical 気/げ suffix = 'has the air of ~'. Attaches to feelings: 楽し-げ(looks happy), 寂し-げ(looks lonely).",
  "～やら～やら": "やら from や(or) + ら(and others) → 'this and that and who knows what else' → overwhelmed by many things.",
  "～にほかならない": "他(other) + ならない(is not) = 'is nothing other than X' → emphasis: precisely X, definitely X.",
  "～にすぎない": "過ぎる(exceed) + ない(not) → 'does not exceed' → 'merely ~, nothing more'. Belittles the scale.",
  "～といっても": "と(quote) + 言って(saying) + も(even) → 'even though I say ~, actually ~'. Prepares for a downplay.",
  "～だけあって": "だけ(extent) + あって(having that much) → 'as expected of someone at that level' — praise, befitting.",
  "～にしろ～にしろ / にしても / にせよ": "Classical imperative of する → 'whether you take A or B, the outcome is the same'.",
  "～とか": "と(quote) + か(uncertainty) → 'something like ~ I heard' — vague hearsay, source unclear.",
  "～にそって": "沿う(run along/parallel) → 'moving along the line of ~' → following a path, plan, or guideline.",
  "～にかけては": "掛ける(stake on/hang on) → 'when it comes to staking it on this skill' → in this domain, no one beats me.",
  "～ないことには": "ないこと(the matter of NOT doing) + には → 'unless this happens, things can't proceed'. Strong precondition.",
  "～がち": "From 勝ち(winning/dominant) → 'the dominant pattern is ~' → tends to (usually negative): 病気がち, 忘れがち.",
  "～つつ（も）": "つつ(while doing) + も(even) → 'even while doing A, B contradicts'. Classical contrast register.",
  "～としたら": "と(quote) + したら(if did) → 'if we suppose that ~'. と marks the supposition, したら is the if-form.",
  "～にこたえて": "応える(answer/respond to) → 'in response to expectations/demand' → meeting hopes, formal.",
  "～ことにする": "こと(matter) + にする(make it) → 'I make it the matter that ~' → 'I decide to ~' or 'I'll pretend ~'.",
  "～つもり": "From 積もり(accumulation) → 'piled-up intention' → 'I intended to ~' or 'I think I did, but actually didn't'.",
  "～てならない": "ならない(can't help becoming) → emotion is so strong you can't stop it. '~ to the point I can't bear it'.",
  "～ものなら": "もの(thing) + なら(if it could be) → 'if such a thing as ~ were possible' — challenge or wish.",
  "～うか～まいか": "Volitional う(will do) + classical まい(will not) → 'should I or shouldn't I?' — agonized indecision.",
  "～たとえ～ても": "例え(even supposing) → 'even supposing the worst case, I still ~'. Strong determination.",
  "～がたい": "難い(hard/difficult) → 'difficult to do' — emotionally, not physically. 信じがたい, 受け入れがたい.",
  "～もかまわず": "構う(care/mind) + ず(not) → 'not caring even about ~' → ignoring social rules or others' feelings.",
  "～あまり（に）": "余り(excess/too much) → 'so much ~ that as a result B happened'. Excessive cause leading to a result.",
  "～も～ば～も": "も(also) + ば(if/and) + も(also) → 'A is true and B is also true' → balanced enumeration.",
  "～ぬく": "抜く(pull out/through) → 'do it ALL the way through to the end, no matter the difficulty'. Endurance.",
  "～ものだ": "物(thing) + だ(is) → 'that's just how things are/were' → general truth or nostalgic recollection.",
  "～をめぐって": "巡る(go around/revolve) → 'circling around the topic of ~' → debate or dispute centered on this.",
  "～にあたって": "当たる(hit/face) → 'at the moment of facing ~' → formal 'on the occasion of'. Ceremonies, transitions.",
  "～とあって": "と(given that) + あって(it being) → 'given the special situation that ~' → specialness leads to obvious result.",
  "～ならではの": "なら(if it were) + では(no other) → 'something only ~ can offer' → unique to that source/era/person.",
  "～にもまして": "増す(increase/exceed) → 'even more than before' → comparison emphasizing greater degree than expected.",
  "～からして": "から(from) + して(doing) → 'starting from just ~' → smallest detail mentioned implies the bigger picture.",
  "～といえども": "Classical concessive: と(quote) + 言えど(though saying) + も(even) → 'even though one might say it's X, ~'.",
  "～たりとも…ない": "Old enumerative たり(even one example) + とも(even) + ない → 'not even one example exists' → absolute zero.",
  "～きらいがある": "嫌い(dislike) → 'has a tendency that one would dislike' → bad/undesirable habit. Negative observation.",
  "そもそも": "Older 抑(holding down/originally) doubled → 'going all the way back to the very beginning' = 'in the first place'.",
  "あえて": "From 敢う(to dare) → 'daringly/deliberately doing what you don't have to'. Going out of your way to ~.",
  "いわば": "From 言わば (literally 'if one were to say') → 'so to speak / metaphorically'. Drops in a comparison.",
  "とりわけ": "From 取り分ける(set aside specially) → 'singled out, set apart' → 'especially, in particular'.",
  "むしろ": "Classical 寧ろ(rather/sooner) → flips the listener's expectation: 'you'd think A, but if anything, B (the opposite)'.",
  "なぜなら～からです": "何故(why) + なら(if asking) + から(because) → answers 'why?' formally. Lecture/essay register.",
  "しかしながら": "しかし(however) + ながら(while) → 'however, while doing X' → softer, more elegant 'however' for formal speech.",
  "なおかつ（尚且つ）": "尚(still/even more) + 且つ(moreover/also) → 'on top of all that, still also' — stacking points formally.",
  "こだわり": "From 拘る(stick to/be hung up on) → noun 'attachment to detail' = obsession with quality, the chef's signature insistence.",
  "もたらす": "Old verb 齎す(carry/bring) → 'to bring about, cause'. Classical/literary feel — used for outcomes, blessings.",
  "ジョーク": "Loanword from English 'joke'. Used like the English word — casual, modern, often spoken.",
  "めったにない": "滅多(reckless/random) + ない → 'not even randomly does this happen' → exceedingly rare.",
  "いったい": "一体(literally 'one body / the whole thing') → 'what on earth IS this thing?!' — emphatic 'who/what/why on earth'.",
  "おそらく": "From 恐れる(fear/be apprehensive) → 'one would fear that ~' → 'probably, most likely, I'm afraid' (formal register).",
  "あまりに": "余り(excess) → adverbial 'excessively, to a fault'. Often paired with negative or surprising results.",
  "のではあるまいか": "の + で + ある + まい(classical negative) + か → super-formal hedged speculation. 'Isn't it that ~?' Academic prose.",
  "ぼったくり": "From 打っ手繰る (slang: snatch/grab roughly) → noun for blatant overcharging. Tourist-trap restaurants and shady izakayas.",
  "ぎこちない": "From onomatopoeic ぎこぎこ (creaking sound) + adjective ending → 'creaky and stiff' → awkward movements or speech.",
  "もどかしい": "From classical 擬く-flavor → frustration of being unable to act or express. The inner urge stuck behind a wall.",
  "なおさら": "尚(even more) + 更(again/anew) → 'all the more so, on top of that' → escalates an existing reason.",
  "だらしない": "From classical しだら(orderly state) — reversed and negated → 'not in proper order' → sloppy, undisciplined.",
  "そっけない": "素(plain/bare) + 気(feeling/vibe) + ない → 'no warmth in the air' → bluntly cold or curt response.",
  "パリピ": "Slang abbreviation of パーティーピーポー (Japanese pronunciation of 'party people') → club kids, weekend ravers.",
};

const path = "src/data.js";
let text = readFileSync(path, "utf-8");
let added = 0;
const skipped = [];

function escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

for (const [jp, story] of Object.entries(STORIES)) {
  // Match `{ jp: "<jp>", ... }`  capturing entry body and trailing ` },`
  const re = new RegExp(`(\\{\\s*jp:\\s*"${escRegex(jp)}"[^\\n]*?)(\\s*\\},)`, "u");
  const m = text.match(re);
  if (!m) { skipped.push(jp); continue; }
  if (m[1].includes("kanjiStory")) continue;  // already has one
  const safe = story.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const replacement = `${m[1]}, kanjiStory: "${safe}"${m[2]}`;
  text = text.replace(re, replacement);
  added++;
}

writeFileSync(path, text, "utf-8");
console.log(`added: ${added}`);
if (skipped.length) {
  console.log(`skipped (no match found): ${skipped.length}`);
  skipped.forEach(s => console.log(`  - ${s}`));
}
