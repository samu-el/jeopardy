import Box from "@mui/material/Box";
import type { SvgIconComponent } from "@mui/icons-material";
import AnchorIcon from "@mui/icons-material/Anchor";
import BedtimeIcon from "@mui/icons-material/Bedtime";
import BoltIcon from "@mui/icons-material/Bolt";
import CasinoIcon from "@mui/icons-material/Casino";
import DiamondIcon from "@mui/icons-material/Diamond";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FlightIcon from "@mui/icons-material/Flight";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import ParkIcon from "@mui/icons-material/Park";
import PersonIcon from "@mui/icons-material/Person";
import PetsIcon from "@mui/icons-material/Pets";
import PsychologyIcon from "@mui/icons-material/Psychology";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import StarIcon from "@mui/icons-material/Star";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import { isAvatarIcon, monogramFor, type AvatarIcon } from "@/lib/game";
import { contrastRatio } from "@/lib/foundation/contrast";
import { jeopardyFonts, ui } from "@/lib/foundation/jeopardy-style";

/** Each avatar key's glyph and its name for a screen reader. */
export const avatarGlyphs: Record<AvatarIcon, { Icon: SvgIconComponent; label: string }> = {
  star: { Icon: StarIcon, label: "Star" },
  bolt: { Icon: BoltIcon, label: "Bolt" },
  rocket: { Icon: RocketLaunchIcon, label: "Rocket" },
  paw: { Icon: PetsIcon, label: "Paw" },
  brain: { Icon: PsychologyIcon, label: "Brain" },
  dice: { Icon: CasinoIcon, label: "Dice" },
  music: { Icon: MusicNoteIcon, label: "Music" },
  heart: { Icon: FavoriteIcon, label: "Heart" },
  flame: { Icon: LocalFireDepartmentIcon, label: "Flame" },
  moon: { Icon: BedtimeIcon, label: "Moon" },
  sun: { Icon: WbSunnyIcon, label: "Sun" },
  tree: { Icon: ParkIcon, label: "Tree" },
  diamond: { Icon: DiamondIcon, label: "Diamond" },
  anchor: { Icon: AnchorIcon, label: "Anchor" },
  plane: { Icon: FlightIcon, label: "Plane" },
  coffee: { Icon: LocalCafeIcon, label: "Coffee" },
};

/** Dark or light glyph, whichever reads better on the player's colour. */
export function avatarInk(background: string): string {
  return contrastRatio(ui.stage, background) >= contrastRatio(ui.ink, background) ? ui.stage : ui.ink;
}

interface PlayerAvatarProps {
  name: string;
  avatar?: string;
  color?: string;
  size?: number;
  /** A ring in the surface colour, for a face that sits over an edge (the lectern). */
  ring?: string;
}

/**
 * A player's face: their icon, or their initial, on their colour. Anything
 * that is not a known icon key (an older client's emoji included) draws the
 * initial, so a face is never a picture the player typed.
 */
export function PlayerAvatar({ name, avatar, color, size = 32, ring }: PlayerAvatarProps) {
  const background = color ?? ui.surfaceRaised;
  const ink = color ? avatarInk(color) : ui.ink;
  const glyph = isAvatarIcon(avatar) ? avatarGlyphs[avatar] : undefined;
  const monogram = glyph ? undefined : monogramFor(name);
  const FallbackIcon = glyph?.Icon ?? PersonIcon;
  return (
    <Box
      aria-hidden
      data-avatar={glyph ? avatar : monogram ? "initial" : "none"}
      sx={{
        flex: "0 0 auto",
        width: size,
        height: size,
        borderRadius: "50%",
        background,
        border: ring ? `2px solid ${ring}` : `1px solid ${ui.lineStrong}`,
        color: ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
      }}
    >
      {monogram ? (
        <Box
          component="span"
          sx={{
            fontFamily: jeopardyFonts.display,
            fontWeight: 600,
            fontSize: Math.max(16, Math.round(size * 0.5)),
            textTransform: "uppercase",
          }}
        >
          {monogram}
        </Box>
      ) : (
        <FallbackIcon sx={{ fontSize: Math.round(size * 0.6) }} />
      )}
    </Box>
  );
}
