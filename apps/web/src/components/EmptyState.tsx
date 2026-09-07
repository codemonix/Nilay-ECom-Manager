import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InboxIcon from "@mui/icons-material/InboxOutlined";

export function EmptyState({ message }: { message: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        py: 6,
        color: "text.secondary",
      }}
    >
      <InboxIcon fontSize="large" />
      <Typography variant="body2">{message}</Typography>
    </Box>
  );
}
