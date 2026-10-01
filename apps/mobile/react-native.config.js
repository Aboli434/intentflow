module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: null, // disable React Native autolinking for expo because ExpoModulesPackage is handled by expo-modules-autolinking
      },
    },
  },
};
