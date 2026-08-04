package com.greenart7c3.citrine.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.SubcomposeAsyncImage
import coil3.request.ImageRequest

/**
 * Shows an nsite's icon (a Blossom URL or a local [java.io.File]) via Coil on a rounded-square
 * tonal background. Falls back to a [monogram] letter (or a globe placeholder when no monogram
 * is available) while loading or when no icon is available/decodable.
 */
@Composable
fun NsiteIcon(
    model: Any?,
    modifier: Modifier = Modifier,
    monogram: String? = null,
    size: Dp = 40.dp,
) {
    val shape = RoundedCornerShape(size * 0.25f)
    Box(
        modifier = modifier
            .size(size)
            .clip(shape)
            .background(MaterialTheme.colorScheme.secondaryContainer),
        contentAlignment = Alignment.Center,
    ) {
        if (model == null) {
            Fallback(monogram, size)
        } else {
            SubcomposeAsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(model)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(size),
                loading = { Fallback(monogram, size) },
                error = { Fallback(monogram, size) },
            )
        }
    }
}

@Composable
private fun Fallback(
    monogram: String?,
    size: Dp,
) {
    if (!monogram.isNullOrBlank()) {
        Text(
            monogram.take(1).uppercase(),
            style = if (size >= 48.dp) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSecondaryContainer,
        )
    } else {
        Icon(
            imageVector = Icons.Default.Public,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSecondaryContainer,
            modifier = Modifier.size(size * 0.7f),
        )
    }
}
