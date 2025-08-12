const jsonBinaryBlobCodec = (): {
  replacer: (key: string, value: Uint8Array) => unknown;
  reviver: (key: string, value: unknown) => unknown;
} => {
  // URL-safe Base64 encoding/decoding (RFC 4648)
  const b64 = {
    encode(data: Uint8Array): string {
      // Convert to standard Base64 first, then make it URL-safe
      const standardBase64 = btoa(
        // eslint-disable-next-line unicorn/prefer-spread
        String.fromCharCode.apply(null, Array.from(data)),
      );
      // eslint-disable-next-line unicorn/prefer-string-replace-all
      return standardBase64.replace(/\+/g, '-').replace(/\//g, '_');
    },
    decode(base64: string): Uint8Array {
      // Convert from URL-safe to standard Base64 first
      // eslint-disable-next-line unicorn/prefer-string-replace-all
      const standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
      const binaryString = atob(standardBase64);
      return new Uint8Array(
        // eslint-disable-next-line unicorn/prefer-spread
        binaryString.split('').map((char) => {
          // eslint-disable-next-line unicorn/prefer-code-point
          return char.charCodeAt(0);
        }),
      );
    },
  };

  return {
    replacer(this: Record<string, Uint8Array>, key: string) {
      const replacerValue = this[key];
      return ArrayBuffer.isView(replacerValue)
        ? { $d: b64.encode(new Uint8Array(replacerValue.buffer)) }
        : replacerValue;
    },
    reviver: (_key: string, reviverValue: unknown) => {
      if (reviverValue === null || typeof reviverValue !== 'object') {
        return reviverValue;
      }

      if (!('$d' in reviverValue) || typeof reviverValue.$d !== 'string') {
        return reviverValue;
      }

      const decodedData = b64.decode(reviverValue.$d);
      // Create a new ArrayBuffer from the Uint8Array to ensure compatibility
      // eslint-disable-next-line unicorn/prefer-spread
      const arrayBuffer = decodedData.slice().buffer;
      return new Blob([arrayBuffer]);
    },
  };
};

export default jsonBinaryBlobCodec();
