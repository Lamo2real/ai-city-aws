// The repo's config files, loaded once. JSON imports are bundled into Lambdas and the runtime image.
import models from "../../../config/models.json" with { type: "json" };
import caps from "../../../config/caps.json" with { type: "json" };
import policy from "../../../config/policy.json" with { type: "json" };

export const MODELS_CONFIG = models;
export const CAPS_CONFIG = caps;
export const POLICY_CONFIG = policy;
