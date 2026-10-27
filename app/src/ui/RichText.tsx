import { Text, View } from "react-native";
import { space, type } from "./theme.ts";

/** Renders the small markdown subset FixBot uses: **bold**, "-" bullets, "1." lists and "#" headings. */
export function RichText({ text, color }: { text: string; color: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  return (
    <View style={{ gap: 4 }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={{ height: 4 }} />;
        const heading = /^#{1,4}\s+(.*)$/.exec(line);
        if (heading) {
          return (
            <Text key={i} style={[type.headline, { color, marginTop: 2 }]}>
              {inline(heading[1], color)}
            </Text>
          );
        }
        const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
        const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
        if (bullet || numbered) {
          const indent = /^\s{2,}/.test(line) ? space.l : 0;
          return (
            <View key={i} style={{ flexDirection: "row", gap: 6, paddingLeft: indent }}>
              <Text style={[type.body, { color, minWidth: numbered ? 20 : 10 }]}>{numbered ? `${numbered[1]}.` : "•"}</Text>
              <Text style={[type.body, { color, flex: 1 }]}>{inline(bullet ? bullet[1] : numbered![2], color)}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={[type.body, { color }]}>
            {inline(line, color)}
          </Text>
        );
      })}
    </View>
  );
}

function inline(text: string, color: string) {
  // Split on **bold** spans; everything else is plain text.
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <Text key={i} style={{ fontWeight: "700", color }}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      part
    ),
  );
}
