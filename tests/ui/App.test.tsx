import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../../src/App';

describe('Beriday app shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('guides a first-time user to choose a region before showing a schedule', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '오늘 버릴 수 있는 것부터 확인하세요' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '지역 설정하기' })).toBeInTheDocument();
    expect(screen.getByText('GPS 없이 행정구역만 저장합니다.')).toBeInTheDocument();
  });

  it('lets a user choose a region, saves it locally, and enters Today', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '지역 설정하기' }));
    expect(screen.getByRole('heading', { name: '지역을 선택하세요' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('시/도'), { target: { value: '광주광역시' } });
    fireEvent.change(screen.getByLabelText('시/군/구'), { target: { value: '북구' } });
    fireEvent.change(screen.getByLabelText('관리구역'), { target: { value: '테스트동' } });
    fireEvent.click(screen.getByRole('button', { name: '이 지역으로 시작하기' }));

    expect(screen.getByRole('heading', { name: '오늘의 배출' })).toBeInTheDocument();
    expect(screen.getByText('광주광역시 북구 테스트동')).toBeInTheDocument();
    expect(window.localStorage.getItem('beriday:saved-region:v1')).toContain('광주광역시/북구/테스트동');
  });

  it('restores a previously saved valid region on a new app render', () => {
    window.localStorage.setItem(
      'beriday:saved-region:v1',
      JSON.stringify({
        regionId: '광주광역시/북구/테스트동',
        savedAt: '2026-08-27T12:00:00.000Z',
      }),
    );

    render(<App />);

    expect(screen.getByRole('heading', { name: '오늘의 배출' })).toBeInTheDocument();
    expect(screen.getByText('광주광역시 북구 테스트동')).toBeInTheDocument();
  });
});
