import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type GeoJSONSourceRef,
} from '@maplibre/maplibre-react-native';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, type NativeSyntheticEvent } from 'react-native';

import { mapConfig, mapStyleUrl } from '@/features/map/config/map.config';
import type { MapPoint } from '@/features/map/types/map.types';
import { boundsFor, toLngLat, type Coords } from '@/features/map/utils/coordinates';
import { useTheme } from '@/theme';

export type MapCanvasHandle = {
  fitRoute: (origin: Coords, dest: Coords) => void;
  locate: (coords: Coords) => void;
};

type Props = {
  points: MapPoint[];
  selectedId: string | null;
  user: Coords | null;
  center: Coords;
  routeGeometry: GeoJSON.LineString | null;
  sessionMode: boolean;
  onSelect: (id: string | null) => void;
  onTilesFailed: () => void;
};

export const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas(
  { points, selectedId, user, center, routeGeometry, sessionMode, onSelect, onTilesFailed },
  ref,
) {
  const { colors, scheme } = useTheme();
  const camera = useRef<CameraRef>(null);
  const source = useRef<GeoJSONSourceRef>(null);

  useImperativeHandle(ref, () => ({
    fitRoute: (origin, dest) => {
      camera.current?.fitBounds(boundsFor(origin, dest), {
        padding: { top: 80, bottom: 220, left: 48, right: 48 },
        duration: 600,
        easing: 'ease',
      });
    },
    locate: (coords) => {
      camera.current?.easeTo({ center: toLngLat(coords), zoom: 14, duration: 400 });
    },
  }));

  const beneficiaries = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        id: p.id,
        geometry: { type: 'Point', coordinates: toLngLat(p.coords) },
        properties: {
          pointId: p.id,
          visit: p.visit ?? 'other',
          selected: p.id === selectedId,
        },
      })),
    }),
    [points, selectedId],
  );

  const userGeo = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: user
        ? [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: toLngLat(user) },
              properties: { kind: 'user' },
            },
          ]
        : [],
    }),
    [user],
  );

  const routeGeo = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: routeGeometry ? [{ type: 'Feature', geometry: routeGeometry, properties: {} }] : [],
    }),
    [routeGeometry],
  );

  const onSourcePress = async (event: NativeSyntheticEvent<{ features: GeoJSON.Feature[] }>) => {
    const feature = event.nativeEvent.features[0];
    if (!feature) return;
    const props = feature.properties ?? {};
    if (props.cluster) {
      const clusterId = Number(props.cluster_id);
      const zoom = await source.current?.getClusterExpansionZoom(clusterId);
      const coords = feature.geometry.type === 'Point' ? feature.geometry.coordinates : null;
      if (coords && zoom != null) {
        camera.current?.easeTo({ center: [coords[0]!, coords[1]!], zoom, duration: 350 });
      }
      return;
    }
    const id = typeof props.pointId === 'string' ? props.pointId : null;
    if (id) onSelect(id);
  };

  return (
    <Map style={styles.map} mapStyle={mapStyleUrl(scheme)} attribution onDidFailLoadingMap={onTilesFailed}>
      <Camera ref={camera} initialViewState={{ center: toLngLat(center), zoom: mapConfig.defaultZoom }} />
      <GeoJSONSource id="route" data={routeGeo}>
        <Layer
          id="route-casing"
          type="line"
          paint={{ 'line-color': colors.mapRouteCasing, 'line-width': 8, 'line-opacity': 0.9 }}
        />
        <Layer
          id="route-line"
          type="line"
          paint={{ 'line-color': colors.mapRoute, 'line-width': 4, 'line-opacity': 1 }}
        />
      </GeoJSONSource>
      <GeoJSONSource
        ref={source}
        id="beneficiaries"
        data={beneficiaries}
        cluster
        clusterRadius={mapConfig.clusterRadius}
        clusterMaxZoom={14}
        onPress={onSourcePress}
      >
        <Layer
          id="clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': colors.mapCluster,
            'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
            'circle-opacity': 0.92,
          }}
        />
        <Layer
          id="cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{ 'text-field': ['to-string', ['get', 'point_count']], 'text-size': 12 }}
          paint={{ 'text-color': colors.onPrimary }}
        />
        <Layer
          id="pins"
          type="circle"
          filter={['all', ['!', ['has', 'point_count']], ['!=', ['get', 'selected'], true]]}
          paint={{
            'circle-color': sessionMode
              ? [
                  'match',
                  ['get', 'visit'],
                  'visited',
                  colors.mapVisited,
                  'ignored',
                  colors.warning,
                  colors.mapRemaining,
                ]
              : colors.mapPin,
            'circle-radius': 7,
            'circle-stroke-width': 2,
            'circle-stroke-color': colors.surface,
          }}
        />
        <Layer
          id="pin-selected"
          type="circle"
          filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'selected'], true]]}
          paint={{
            'circle-color': colors.mapSelected,
            'circle-radius': 10,
            'circle-stroke-width': 3,
            'circle-stroke-color': colors.mapRouteCasing,
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="user" data={userGeo}>
        <Layer
          id="user-dot"
          type="circle"
          paint={{
            'circle-color': colors.mapUser,
            'circle-radius': 8,
            'circle-stroke-width': 3,
            'circle-stroke-color': colors.mapUserStroke,
          }}
        />
      </GeoJSONSource>
    </Map>
  );
});

const styles = StyleSheet.create({
  map: { flex: 1 },
});
