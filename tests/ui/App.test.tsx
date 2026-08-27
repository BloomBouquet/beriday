import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../src/App';

describe('Beriday app shell', () => {
  it('guides a first-time user to choose a region before showing a schedule', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '오늘 버릴 수 있는 것부터 확인하세요' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '지역 설정하기' })).toBeInTheDocument();
    expect(screen.getByText('GPS 없이 행정구역만 저장합니다.')).toBeInTheDocument();
  });
});
