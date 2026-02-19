export interface SpotifyUser {
  id: string;
  display_name: string;
  images: Array<{ url: string; height: number; width: number }>;
  external_urls: { spotify: string };
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  external_urls: { spotify: string };
}

export interface SpotifyPlaylistItem {
  added_at: string;
  added_by: { id: string; uri: string; external_urls: { spotify: string } };
  item: SpotifyTrack;
}

export interface SpotifyRecentlyPlayedItem {
  track: SpotifyTrack;
  played_at: string;
  context: { type: string; uri: string } | null;
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  collaborative: boolean;
  public: boolean;
  snapshot_id: string;
  external_urls: { spotify: string };
  owner: SpotifyUser;
}

export interface SpotifySearchResult {
  tracks: {
    items: SpotifyTrack[];
    total: number;
    limit: number;
    offset: number;
  };
}

export interface SpotifyPaginatedResponse<T> {
  items: T[];
  next: string | null;
  cursors?: { after: string; before: string };
  limit: number;
  total?: number;
}
