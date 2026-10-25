import { messages0 } from "./messages0";
import { messages1 } from "./messages1";
import { messages2 } from "./messages2";
import { messages3 } from "./messages3";
import { messages4 } from "./messages4";
import { messages5 } from "./messages5";
import { messages6 } from "./messages6";
import { supplemental } from "./supplemental";

export const messages = {
  id: { ...messages0.id, ...messages1.id, ...messages2.id, ...messages3.id, ...messages4.id, ...messages5.id, ...messages6.id, ...supplemental.id },
  en: { ...messages0.en, ...messages1.en, ...messages2.en, ...messages3.en, ...messages4.en, ...messages5.en, ...messages6.en, ...supplemental.en },
};
