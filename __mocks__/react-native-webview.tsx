// Jest 用の代役: 本物のモジュールは import 時にネイティブの TurboModule を要求する。
import { useImperativeHandle, type Ref } from "react";
import { View } from "react-native";

export const mockCommands = {
  goBack: jest.fn(),
  goForward: jest.fn(),
  reload: jest.fn(),
  stopLoading: jest.fn(),
  injectJavaScript: jest.fn(),
};

export function WebView({ ref, ...props }: { ref?: Ref<typeof mockCommands> }) {
  useImperativeHandle(ref, () => mockCommands);
  return <View testID="webview" {...props} />;
}

export default WebView;
