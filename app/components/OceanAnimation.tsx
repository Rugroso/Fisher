import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const FISH_COLORS = [
  '#8BB9FE', // Azul claro
  '#4FC3F7', // Azul cielo
  '#81D4FA', // Azul celeste
  '#80DEEA', // Azul turquesa
  '#4DD0E1', // Azul cyan
  '#26C6DA', // Azul cyan oscuro
  '#00BCD4', // Azul cyan medio
  '#00ACC1', // Azul cyan profundo
  '#0097A7', // Azul cyan muy profundo
  '#00838F', // Azul cyan muy oscuro
  '#006064', // Azul cyan casi negro
  '#80CBC4', // Verde azulado claro
  '#4DB6AC', // Verde azulado
  '#26A69A', // Verde azulado medio
  '#009688', // Verde azulado profundo
];

interface Fish {
  id: number;
  position: Animated.ValueXY;
  rotation: Animated.Value;
  scale: Animated.Value;
  direction: number;
  color: string;
}

interface Bubble {
  id: number;
  position: Animated.ValueXY;
  scale: Animated.Value;
  opacity: Animated.Value;
  speed: number;
}

export const OceanAnimation = ({ isActive }: { isActive: boolean }) => {
  const fishes = useRef<Fish[]>([]);
  const bubbles = useRef<Bubble[]>([]);
  const animationRef = useRef<ReturnType<typeof setInterval>>();

  const createFish = () => {
    const fish: Fish = {
      id: Date.now() + Math.random(),
      position: new Animated.ValueXY({
        x: Math.random() * width,
        y: Math.random() * height,
      }),
      rotation: new Animated.Value(0),
      scale: new Animated.Value(1 + Math.random() * 1),
      direction: Math.random() > 0.5 ? 1 : -1,
      color: FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)],
    };
    return fish;
  };

  const createBubble = () => {
    const bubble: Bubble = {
      id: Date.now() + Math.random(),
      position: new Animated.ValueXY({
        x: Math.random() * width,
        y: height + 50,
      }),
      scale: new Animated.Value(0.4 + Math.random() * 0.6),
      opacity: new Animated.Value(0.4 + Math.random() * 0.6),
      speed: 2000 + Math.random() * 3000,
    };
    return bubble;
  };

  const animateFish = (fish: Fish) => {
    const randomX = Math.random() * width;
    const randomY = Math.random() * height;
    const duration = 3000 + Math.random() * 4000;

    Animated.parallel([
      Animated.timing(fish.position, {
        toValue: { x: randomX, y: randomY },
        duration: duration,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(fish.rotation, {
          toValue: fish.direction,
          duration: duration / 2,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(fish.rotation, {
          toValue: -fish.direction,
          duration: duration / 2,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      fish.direction *= -1;
      animateFish(fish);
    });
  };

  const animateBubble = (bubble: Bubble) => {
    const randomX = bubble.position.x._value + (Math.random() * 100 - 50);
    const targetY = -100;

    Animated.timing(bubble.position, {
      toValue: { x: randomX, y: targetY },
      duration: bubble.speed,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      bubble.position.setValue({
        x: Math.random() * width,
        y: height + 50,
      });
      animateBubble(bubble);
    });
  };

  useEffect(() => {
    if (isActive) {
      // Crear peces iniciales
      for (let i = 0; i < 10; i++) {
        const fish = createFish();
        fishes.current.push(fish);
        animateFish(fish);
      }

      // Crear burbujas iniciales
      for (let i = 0; i < 25; i++) {
        const bubble = createBubble();
        bubbles.current.push(bubble);
        animateBubble(bubble);
      }

      // Agregar nuevos elementos periódicamente
      animationRef.current = setInterval(() => {
        if (fishes.current.length < 15) {
          const fish = createFish();
          fishes.current.push(fish);
          animateFish(fish);
        }
        if (bubbles.current.length < 35) {
          const bubble = createBubble();
          bubbles.current.push(bubble);
          animateBubble(bubble);
        }
      }, 2000);
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
      fishes.current = [];
      bubbles.current = [];
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {fishes.current.map((fish) => (
        <Animated.View
          key={`fish-${fish.id}`}
          style={[
            styles.fish,
            {
              transform: [
                { translateX: fish.position.x },
                { translateY: fish.position.y },
                {
                  rotate: fish.rotation.interpolate({
                    inputRange: [-1, 1],
                    outputRange: ['-30deg', '30deg'],
                  }),
                },
                { scale: fish.scale },
              ],
            },
          ]}
        >
          <MaterialCommunityIcons 
            name="fish" 
            size={40} 
            color={fish.color}
            style={{ transform: [{ scaleX: fish.direction }] }}
          />
        </Animated.View>
      ))}

      {bubbles.current.map((bubble) => (
        <Animated.View
          key={`bubble-${bubble.id}`}
          style={[
            styles.bubble,
            {
              transform: [
                { translateX: bubble.position.x },
                { translateY: bubble.position.y },
                { scale: bubble.scale },
              ],
              opacity: bubble.opacity,
            },
          ]}
        >
          <View style={styles.bubbleInner} />
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  fish: {
    position: 'absolute',
  },
  bubble: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
}); 