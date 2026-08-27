import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OfficialDataApp from '../../src/OfficialDataApp';

const officialAsset = JSON.stringify({
  schemaVersion: 1,
  importedAt: '2026-08-28T00:00:00.000Z',
  regions: [
    {
      id: '광주광역시/북구/일곡동',
      sido: '광주광역시',
      sigungu: '북구',
      areaName: '일곡동',
      displayName: '광주광역시 북구 일곡동',
    },
  ],
  rules: [],
  reports: {},
});

describe('OfficialDataApp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('shows loading, then exposes regions from the validated official asset', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    render(<OfficialDataApp />);

    expect(screen.getByText('공식 데이터를 불러오는 중입니다.')).toBeInTheDocument();

    resolveFetch?.({
      ok: true,
      text: async () => officialAsset,
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '지역 설정하기' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '지역 설정하기' }));
    fireEvent.change(screen.getByLabelText('시/도'), { target: { value: '광주광역시' } });
    fireEvent.change(screen.getByLabelText('시/군/구'), { target: { value: '북구' } });

    expect(screen.getByRole('option', { name: '일곡동' })).toBeInTheDocument();
  });
});
