// Doble de PrismaClient: cada modelo (user, caso, feriado...) y cada método
// (findUnique, findMany, create...) se crea al vuelo como jest.fn().
// Los tests definen lo que devuelve cada uno con mockResolvedValue(...).

type ModelMock = Record<string, jest.Mock>;

const models: Record<string, ModelMock> = {};

function getModel(name: string): ModelMock {
  if (!models[name]) {
    const methods: Record<string, jest.Mock> = {};
    models[name] = new Proxy(methods, {
      get(target, method: string) {
        if (!target[method]) target[method] = jest.fn();
        return target[method];
      },
    });
  }
  return models[name];
}

export const prismaMock: Record<string, ModelMock> = new Proxy({} as Record<string, ModelMock>, {
  get(_target, model: string) {
    return getModel(model);
  },
});

/** Borra llamadas Y respuestas configuradas de todos los mocks de Prisma. */
export function resetPrismaMock(): void {
  for (const model of Object.values(models)) {
    for (const fn of Object.values(model)) fn.mockReset();
  }
}
