/**
 * Build _vi-overrides.json via MyMemory (vi→en), then rebuild checklist.
 * Safe: only caches strings that no longer contain Vietnamese.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const viAllPath = path.join(root, "data/poe2_data/_vi-all.json");
const overridesPath = path.join(root, "data/poe2_data/_vi-overrides.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hasVietnamese(s) {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/.test(
    s || ""
  );
}

/** Safe glossary — only full Vietnamese phrases / diacritic-bearing tokens. */
const SAFE = [
  ["(Tùy chọn)", "(Optional)"],
  ["(Nhân vật đầu tiên)", "(First character)"],
  ["Nói chuyện với", "Speak to"],
  ["nói chuyện với", "speak to"],
  ["Nói chuyện", "Speak to"],
  ["nói chuyện", "speak to"],
  ["Đánh bại", "Defeat"],
  ["đánh bại", "defeat"],
  ["Teleport về town", "Teleport to town"],
  ["Teleport  về town", "Teleport to town"],
  ["Teleport về", "Teleport to"],
  ["Teleport tới", "Teleport to"],
  ["trang bị vũ khí khởi đầu", "equip starting weapon"],
  ["trang bị item và skill nhặt được", "equip looted items and skills"],
  ["cây cầu phía trước dẫn tới", "the bridge ahead leads to"],
  ["để bắt đầu quest", "to start the quest"],
  ["để bắt đầu nhiệm vụ", "to start the quest"],
  ["để nhận thưởng", "for the reward"],
  ["phía sau boss", "behind the boss"],
  ["ở phía bắc", "in the north"],
  ["phía bắc", "the north"],
  ["boss cuối Act", "Act finale boss"],
  ["tiến trình chính", "the main path"],
  ["obelisk cuối", "the final obelisk"],
  ["xuất hiện ở", "appears at"],
  ["Xuất hiện ở", "Appears at"],
  ["xuất hiện", "appears"],
  ["quay lại", "return"],
  ["Quay lại", "Return"],
  ["quay về", "return to"],
  ["Quay về", "Return to"],
  ["Đi vào", "Enter"],
  ["đi vào", "enter"],
  ["Đi tới", "Go to"],
  ["đi tới", "go to"],
  ["Đi theo", "Follow"],
  ["đi theo", "follow"],
  ["Đi xuống dưới", "Go downstairs"],
  ["đi xuống dưới", "go downstairs"],
  ["Đi xuống", "Go down"],
  ["đi xuống", "go down"],
  ["Đi lên", "Go up"],
  ["đi lên", "go up"],
  ["Đi xuyên qua", "Go through"],
  ["Lấy Waypoint", "Take Waypoint"],
  ["lấy Waypoint", "take Waypoint"],
  ["Kích hoạt", "Activate"],
  ["kích hoạt", "activate"],
  ["Triệu hồi", "Summon"],
  ["triệu hồi", "summon"],
  ["Hoàn thành", "Complete"],
  ["hoàn thành", "complete"],
  ["Tương tác với", "Interact with"],
  ["tương tác với", "interact with"],
  ["Tương tác", "Interact with"],
  ["tương tác", "interact with"],
  ["tiêu diệt", "defeat"],
  ["Sau khi", "After"],
  ["sau khi", "after"],
  ["Trước khi", "Before"],
  ["trước khi", "before"],
  ["gần checkpoint", "near the checkpoint"],
  ["cạnh checkpoint", "near the checkpoint"],
  ["ở thị trấn", "in town"],
  ["trong thị trấn", "in town"],
  ["ở town", "in town"],
  ["thị trấn", "town"],
  ["Đem", "Bring"],
  ["đưa cho", "give to"],
  ["Đưa cho", "Give to"],
  ["Nhận", "Receive"],
  ["nhận", "receive"],
  ["Lấy", "Take"],
  ["lấy", "take"],
  ["Hạ", "Defeat"],
  ["hạ", "defeat"],
  ["Tìm", "Find"],
  ["tìm", "find"],
  ["Mở", "Open"],
  ["mở", "open"],
  ["Đặt", "Place"],
  ["đặt", "place"],
  ["Giết", "Kill"],
  ["giết", "kill"],
  ["Chờ", "Wait"],
  ["Trả", "Turn in"],
  ["trả", "turn in"],
  ["Dùng", "Use"],
  ["dùng", "use"],
  ["Ra ", "Exit to "],
  ["Vào ", "Enter "],
  ["vào ", "enter "],
  ["Nói ", "Speak to "],
  ["nói ", "speak to "],
  ["Cấp ", "Level "],
  ["※ Tỷ lệ rơi cần được xác nhận", "(drop rate unconfirmed)"],
  ["※ Tỉ lệ rơi cần được xác nhận", "(drop rate unconfirmed)"],
  ["(Tỉ lệ rơi cần được xác nhận)", "(drop rate unconfirmed)"],
  ["Tỷ lệ rơi cần được xác nhận", "drop rate unconfirmed"],
  ["Tỉ lệ rơi cần được xác nhận", "drop rate unconfirmed"],
  ["Khu Cắm Trại Bí Ẩn", "Mysterious Campsite"],
  ["Mẹo đánh", "Fight tip:"],
  ["Mẹo boss", "Boss tip:"],
  ["Mẹo:", "Tip:"],
  ["MẸO BOSS:", "BOSS TIP:"],
  ["MẸO ĐƯỜNG ĐI:", "PATHING TIP:"],
  ["Lưu ý:", "Note:"],
  ["Lưu ý", "Note"],
  ["Nhiệm vụ Ascendancy", "Ascendancy quest"],
  ["rương", "chest"],
  ["mỗi obelisk", "each obelisk"],
  ["mỗi", "each"],
  ["viên", "stones"],
  ["khu vực", "area"],
  ["khu nhà", "house area"],
  ["con đường", "the road"],
  ["luồng nước", "water flow"],
  ["dẫn vào trong", "leading inward"],
  ["là cách dễ nhất để tới", "is the easiest way to reach"],
  ["đường đá", "the stone path"],
  ["cùng căn nhà", "the same house"],
  ["trong nhà", "in the house"],
  ["trong căn nhà gần", "in the house near"],
  ["trong cánh đồng", "in the fields"],
  ["Lên lầu", "Go upstairs"],
  ["gạt Lever", "pull the Lever"],
  ["thường nằm về phía bắc của", "is usually north in"],
  ["nên có Flask khoảng", "aim for Flask around"],
  ["và chest khoảng", "and chest around"],
  ["để an toàn hơn", "for more safety"],
  ["tiếp tục đi sâu xuống các tầng dưới để tìm", "keep going deeper downstairs to find"],
  ["Trong Manor có vài đoạn đường vòng nên ưu tiên bám theo hướng đi xuống", "The Manor has winding paths — stick to the downward route"],
  ["đừng cố đứng yên DPS khi vùng nguy hiểm đang phủ sàn", "do not stand still DPS while danger zones cover the floor"],
  ["tất cả NPC", "all NPCs"],
  ["sang Act", "to Act"],
  ["ở tầng 1", "on floor 1"],
  ["lần đầu", "the first time"],
  ["trong lồng", "in the cage"],
  ["để mở cổng", "to open the gate"],
  ["Tiến tới", "Advance to"],
  ["trước khi mở cổng", "before opening the gate"],
  ["cạnh", "near"],
  ["gần", "near"],
  ["trong", "in"],
  ["và", "and"],
  ["để", "to"],
  ["từ", "from"],
  ["với", "with"],
  ["của", "of"],
  ["cho", "for"],
  ["đã", "already"],
  ["sẽ", "will"],
  ["có thể", "can"],
  ["không cần", "no longer need to"],
  ["không còn", "no longer has"],
  ["một số", "some"],
  ["Mỗi", "Each"],
  ["mỗi", "each"],
  ["tầng", "tier"],
  ["công thức mới", "new recipes"],
  ["gọi", "call"],
  ["đường tắt mới", "the new shortcut"],
  ["route hiện tại đã dùng", "the current route already uses"],
  ["nữa", "anymore"],
  ["sau khi cứu", "after rescuing"],
  ["quay qua", "go back through"],
  ["Đa số build có thể bỏ", "Most builds can skip"],
  ["lúc này", "for now"],
  ["dự phòng", "backup"],
  ["sẽ dễ hơn", "will be easier"],
  ["và cho trial", "and gives a trial"],
  ["tốt hơn", "that is better"],
  ["Các lá bùa trên tường cho biết", "Charms on the walls indicate"],
  ["đang ở gần", "is nearby"],
  ["ngõ cụt", "a dead end"],
  ["cầu thang", "the stairs"],
  ["khu vực đầy vàng", "the gold-filled area"],
  ["bám theo đường ray", "follow the rail tracks"],
  ["Ở mỗi giao lộ, chọn nhánh nối tiếp với đường ray để giữ đúng tuyến chính", "At each junction, take the branch that continues the rails to stay on the main route"],
  ["tại giao lộ chọn nhánh nối tiếp đường ray", "at junctions take the branch that continues the rails"],
  ["theo checkpoints", "following checkpoints"],
  ["di chuyển giữa nhiều khu vực", "travel between many areas"],
  ["Hãy làm theo thứ tự bên dưới", "Follow the order below"],
  ["để tránh phải quay lại khu vực cũ và mất thời gian", "to avoid backtracking and wasting time"],
  ["sử dụng", "uses"],
  ["và Desert Map", "and the Desert Map"],
];

function applySafe(text) {
  let out = text;
  const sorted = [...SAFE].sort((a, b) => b[0].length - a[0].length);
  for (const [vi, en] of sorted) {
    if (out.includes(vi)) out = out.split(vi).join(en);
  }
  return out
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function polish(s) {
  let t = String(s || "")
    .replace(/\bTake down\b/gi, "Defeat")
    .replace(/\bTalk to\b/gi, "Speak to")
    .replace(/\bGo into\b/gi, "Enter")
    .replace(/\s+/g, " ")
    .trim();
  if (t && !t.startsWith("(") && !t.startsWith('"') && /^[a-z]/.test(t)) {
    t = t[0].toUpperCase() + t.slice(1);
  }
  return t;
}

async function myMemory(text) {
  const url =
    "https://api.mymemory.translated.net/get?langpair=vi|en&q=" +
    encodeURIComponent(text.slice(0, 450));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.responseStatus !== 200) throw new Error(String(data.responseDetails || data.responseStatus));
  return data.responseData.translatedText;
}

async function main() {
  const all = JSON.parse(fs.readFileSync(viAllPath, "utf8"));
  let overrides = {};
  try {
    overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
  } catch {}

  let done = 0;
  let failed = 0;
  for (const src of all) {
    if (overrides[src] && !hasVietnamese(overrides[src])) {
      done += 1;
      continue;
    }

    // Try safe glossary first
    let local = polish(applySafe(src));
    if (!hasVietnamese(local)) {
      overrides[src] = local;
      done += 1;
      continue;
    }

    try {
      const api = await myMemory(src);
      let out = polish(api);
      // Prefer glossary pass on original if API still has VI (shouldn't) or looks worse
      if (hasVietnamese(out)) out = local;
      // Post-fix common MT quirks
      out = out
        .replace(/\bTake down\b/gi, "Defeat")
        .replace(/\bTalk to\b/gi, "Speak to")
        .replace(/\bOptional\)/gi, "Optional)")
        .replace(/\(\s*Optional\s*\)/gi, "(Optional)");
      overrides[src] = out;
      done += 1;
      process.stdout.write(`\r${done}/${all.length} (fail ${failed})`);
      await sleep(350);
    } catch (err) {
      failed += 1;
      overrides[src] = local; // keep best effort
      process.stdout.write(`\r${done}/${all.length} (fail ${failed}: ${err.message.slice(0, 40)})`);
      await sleep(800);
    }

    if ((done + failed) % 20 === 0) {
      fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2));
    }
  }

  fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2));
  const still = Object.entries(overrides).filter(([, v]) => hasVietnamese(v));
  console.log(`\nOverrides: ${Object.keys(overrides).length}, still VI: ${still.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
