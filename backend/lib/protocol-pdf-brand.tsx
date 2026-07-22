/**
 * Марка „Смолян Клима“ за PDF — същият знак като във frontend Logo.tsx / админ Logo.tsx.
 */
import React from "react";
import { View, Text, Svg, Path, Circle, Defs, LinearGradient, Stop } from "@react-pdf/renderer";

export function ProtocolPdfBrandMark() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Svg width={28} height={34} viewBox="0 5 73 90">
        <Defs>
          <LinearGradient id="pdfSkOrange" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FF4D00" />
            <Stop offset="50%" stopColor="#FF6A00" />
            <Stop offset="100%" stopColor="#FF2A4D" />
          </LinearGradient>
          <LinearGradient id="pdfSkBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#00B4D8" />
            <Stop offset="100%" stopColor="#0077B6" />
          </LinearGradient>
        </Defs>
        <Circle cx={12} cy={12} r={5} stroke="url(#pdfSkOrange)" strokeWidth={3} fill="none" />
        <Path
          d="M 70 15.4 A 40 40 0 0 0 10.1 47 L 28.2 47 A 22 22 0 0 1 61 30.9 Z"
          fill="url(#pdfSkOrange)"
        />
        <Path
          d="M 10.1 53 A 40 40 0 0 0 70 84.6 L 61 69.1 A 22 22 0 0 1 28.2 53 Z"
          fill="url(#pdfSkBlue)"
        />
        <Path d="M 62.6 47 A 13 13 0 0 0 37.4 47 Z" fill="url(#pdfSkOrange)" />
        <Path d="M 37.4 53 A 13 13 0 0 0 62.6 53 Z" fill="url(#pdfSkBlue)" />
      </Svg>
      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
        <Text style={{ fontFamily: "NotoSans", fontSize: 12.5, fontWeight: 700, color: "#FF4D00" }}>
          СМОЛЯН
        </Text>
        <Text style={{ fontFamily: "NotoSans", fontSize: 12.5, fontWeight: 700, color: "#0077B6" }}>
          КЛИМА
        </Text>
      </View>
    </View>
  );
}
