package com.tangjiawei.postcard.ui

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppTopBar(title: String, onSettings: () -> Unit, onRefresh: (() -> Unit)?) {
    CenterAlignedTopAppBar(
        title = { Text(title) },
        actions = {
            if (onRefresh != null) {
                IconButton(onClick = onRefresh) { Icon(Icons.Outlined.Refresh, "刷新") }
            }
            IconButton(onClick = onSettings) { Icon(Icons.Outlined.Settings, "设置") }
        },
        windowInsets = WindowInsets.statusBars,
        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(),
    )
}
