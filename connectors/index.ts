import type { Connector } from "./types.ts";
import { choisirServicePublic } from "./choisir-service-public.ts";
import { jinji } from "./jinji.ts";
import { ssc } from "./ssc.ts";
import { teachingVacancies } from "./teaching-vacancies.ts";
import { upsc } from "./upsc.ts";
import { usajobs } from "./usajobs.ts";

export const connectors: Record<string, Connector> = {
  upsc,
  ssc,
  "teaching-vacancies": teachingVacancies,
  "choisir-service-public": choisirServicePublic,
  usajobs,
  jinji,
};
