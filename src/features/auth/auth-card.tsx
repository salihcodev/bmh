import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { BrandMark } from "@/components/brand/brand-mark";
import { AppText, Header, Screen } from "@/components/ui";
import { spacing } from "@/theme";
import { enter } from "@/theme/motion";

/** Auth layout: white focused screen, centered brand tile, large title and the form below it. */
export function AuthCard({
  title,
  subtitle,
  back = false,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  children: ReactNode;
}) {
  return (
    <Screen
      surface="white"
      header={
        back ? (
          <Header
            title=""
            back
            onBack={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(auth)/login")
            }
          />
        ) : undefined
      }
      contentStyle={styles.content}
    >
      <View style={styles.brand}>
        <Animated.View entering={enter.fade()}>
          <BrandMark size={72} tile />
        </Animated.View>
        <Animated.View entering={enter.rise()} style={styles.titles}>
          <AppText variant="h1" center>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="body" muted center>
              {subtitle}
            </AppText>
          ) : null}
        </Animated.View>
      </View>
      <Animated.View entering={enter.rise()} style={styles.form}>
        {children}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    maxWidth: 480,
    gap: spacing[8],
    paddingTop: spacing[6],
  },
  brand: { alignItems: "center", gap: spacing[4] },
  titles: { alignItems: "center", gap: spacing[1] },
  form: { gap: spacing[2] },
});
