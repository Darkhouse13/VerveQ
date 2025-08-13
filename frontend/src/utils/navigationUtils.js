/**
 * Navigation utilities for safe navigation and debugging
 */

export const safeNavigate = (navigation, screen, params = {}) => {
  try {
    if (!navigation) {
      console.error('Navigation object is undefined');
      return false;
    }

    if (!screen || typeof screen !== 'string') {
      console.error('Invalid screen name:', screen);
      return false;
    }

    console.log(`🧭 Navigating to: ${screen}`, params);
    
    // Check if navigation is ready
    if (navigation.getState && navigation.getState()) {
      navigation.navigate(screen, params);
      console.log(`✅ Navigation to ${screen} successful`);
      return true;
    } else {
      console.error('Navigation state not ready');
      return false;
    }
  } catch (error) {
    console.error(`❌ Navigation to ${screen} failed:`, error);
    return false;
  }
};

export const safeGoBack = (navigation) => {
  try {
    if (!navigation) {
      console.error('Navigation object is undefined');
      return false;
    }

    console.log('🔙 Going back');
    
    if (navigation.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
      console.log('✅ Go back successful');
      return true;
    } else {
      console.log('⚠️ Cannot go back, navigating to Home');
      return safeNavigate(navigation, 'Home');
    }
  } catch (error) {
    console.error('❌ Go back failed:', error);
    return false;
  }
};

export const logNavigationState = (navigation) => {
  try {
    if (navigation && navigation.getState) {
      const state = navigation.getState();
      console.log('📍 Current navigation state:', {
        index: state.index,
        routeNames: state.routeNames,
        routes: state.routes?.map(r => ({ name: r.name, key: r.key }))
      });
    }
  } catch (error) {
    console.error('❌ Failed to log navigation state:', error);
  }
};

export const resetNavigationStack = (navigation, screen = 'Home') => {
  try {
    if (!navigation) {
      console.error('Navigation object is undefined');
      return false;
    }

    console.log(`🔄 Resetting navigation stack to: ${screen}`);
    
    navigation.reset({
      index: 0,
      routes: [{ name: screen }],
    });
    
    console.log(`✅ Navigation stack reset to ${screen}`);
    return true;
  } catch (error) {
    console.error(`❌ Navigation stack reset to ${screen} failed:`, error);
    return false;
  }
};