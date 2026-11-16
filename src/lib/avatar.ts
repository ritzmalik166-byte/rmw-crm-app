import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/** Backend accepts a data URL up to 150k chars (≈100 KB). */
const MAX_CHARS = 150_000;

async function compress(uri: string): Promise<string> {
  for (const [size, quality] of [[320, 0.75], [256, 0.6], [192, 0.5]] as const) {
    const ctx = ImageManipulator.manipulate(uri).resize({ width: size, height: size });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ base64: true, compress: quality, format: SaveFormat.JPEG });
    const url = `data:image/jpeg;base64,${out.base64}`;
    if (url.length <= MAX_CHARS) return url;
  }
  throw new Error("That picture is too large. Try a different one.");
}

/** Opens the camera or gallery with a square crop and returns a compressed JPEG data URL, or null if cancelled. */
export async function pickAvatar(source: "camera" | "library"): Promise<string | null> {
  const perm = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(source === "camera" ? "Allow camera access to take a photo." : "Allow photo access to choose a picture.");
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  return compress(res.assets[0].uri);
}
