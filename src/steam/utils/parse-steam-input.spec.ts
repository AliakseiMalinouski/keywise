import { describe, expect, it } from 'vitest';

import { parseSteamInput } from './parse-steam-input.js';

describe('parseSteamInput', () => {
  it('accepts a SteamID64', () => {
    expect(parseSteamInput('76561198012345678')).toEqual({
      steamid: '76561198012345678',
    });
  });

  it('reads a profiles URL', () => {
    expect(
      parseSteamInput(
        'https://steamcommunity.com/profiles/76561198012345678?l=english',
      ),
    ).toEqual({ steamid: '76561198012345678' });
  });

  it('reads an id URL', () => {
    expect(parseSteamInput('https://steamcommunity.com/id/gaben/')).toEqual({
      vanity: 'gaben',
    });
  });

  it('returns null for unknown input', () => {
    expect(parseSteamInput('not-a-steam-profile')).toBeNull();
    expect(parseSteamInput('https://example.com/id/gaben')).toBeNull();
    expect(parseSteamInput('')).toBeNull();
  });
});
