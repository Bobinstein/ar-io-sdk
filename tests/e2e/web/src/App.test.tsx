import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import {
  DockerComposeEnvironment,
  StartedDockerComposeEnvironment,
  Wait,
} from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import App from './App';

const projectRootPath = process.cwd();

describe('ESM browser validation', () => {
  let compose: StartedDockerComposeEnvironment;
  beforeAll(async () => {
    compose = await new DockerComposeEnvironment(
      projectRootPath,
      '../docker-compose.test.yml',
    )
      .withWaitStrategy('ao-cu-1', Wait.forHttp('/', 6363))
      .up(['ao-cu']);
  });

  afterAll(async () => {
    await compose.down();
  });

  it('should load the app and SDK', async () => {
    await act(async () => render(<App />));

    await waitFor(
      () => {
        screen.getByTestId('load-info-result');
      },
      {
        interval: 5_000,
        timeout: 120_000,
      },
    );

    const result = screen.getByTestId('load-info-result');
    expect(result).toHaveTextContent('true');
  });

  it('should retrieve ids from registry', async () => {
    await act(async () => render(<App />));

    await waitFor(
      () => {
        screen.getByTestId('load-registry-result');
      },
      {
        interval: 5_000,
        timeout: 120_000,
      },
    );

    const result = screen.getByTestId('load-registry-result');
    expect(result).toHaveTextContent('true');
  });
});
